import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";

export const ADMIN_COOKIE_NAME = "sl_admin_session";
export const ADMIN_PERMISSIONS = Object.freeze([
  "dashboard",
  "doctor_verification",
  "document_approval",
  "live_queue",
  "patient_management",
  "doctor_management",
  "complaints_support",
  "analytics",
  "reports",
  "admin_management",
  "audit_logs",
  "settings"
]);

export const ADMIN_ROLES = Object.freeze([
  "super_admin",
  "admin",
  "receptionist",
  "support_admin",
  "verification_admin",
  "analytics_admin"
]);

export const ROLE_DEFAULT_PERMISSIONS = Object.freeze({
  super_admin: [...ADMIN_PERMISSIONS],
  admin: ["dashboard", "doctor_verification", "document_approval", "live_queue", "patient_management", "doctor_management", "analytics", "reports"],
  receptionist: ["dashboard", "live_queue", "patient_management"],
  support_admin: ["dashboard", "patient_management", "complaints_support"],
  verification_admin: ["dashboard", "doctor_verification", "document_approval", "doctor_management"],
  analytics_admin: ["dashboard", "analytics", "reports"]
});

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,128}$/;
const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(256),
  remember: z.boolean().optional().default(false)
});
const adminSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(160),
  mobile: z.string().trim().min(10).max(20),
  role: z.enum(ADMIN_ROLES).default("admin"),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).optional(),
  assignedDoctorIds: z.array(z.string().trim().min(1).max(160)).max(25).optional(),
  password: z.string().regex(PASSWORD_PATTERN).optional()
});
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().regex(PASSWORD_PATTERN, "Password does not meet security requirements")
});

const normalizeIdentifier = value => String(value || "").trim().toLowerCase();
const safeText = (value, maximum = 300) => String(value ?? "").trim().slice(0, maximum);
const nowIso = () => new Date().toISOString();
const publicAdmin = admin => ({
  id: admin.id,
  adminId: admin.adminId,
  fullName: admin.fullName,
  email: admin.email,
  mobile: admin.mobile,
  role: admin.role,
  permissions: [...(admin.permissions || [])],
  assignedDoctorIds: [...(admin.assignedDoctorIds || [])],
  status: admin.status,
  mustChangePassword: Boolean(admin.mustChangePassword),
  createdAt: admin.createdAt,
  lastLogin: admin.lastLogin || null,
  createdBy: admin.createdBy || null
});

function parseCookies(header = "") {
  return String(header).split(";").reduce((cookies, entry) => {
    const separator = entry.indexOf("=");
    if (separator < 0) return cookies;
    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function passwordFromRandomBytes() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%&*?";
  const all = upper + lower + numbers + symbols;
  const pick = alphabet => alphabet[randomBytes(1)[0] % alphabet.length];
  const password = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
  while (password.length < 14) password.push(pick(all));
  return password
    .map(value => ({ value, order: randomBytes(2).readUInt16BE(0) }))
    .sort((left, right) => left.order - right.order)
    .map(item => item.value)
    .join("");
}

export class AdminAuthError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AdminAuthError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class AdminAuthService {
  constructor({ store, jwtSecret, production = process.env.NODE_ENV === "production", now = () => Date.now() }) {
    if (!store) throw new Error("AdminAuthService requires a store");
    if (!jwtSecret || String(jwtSecret).length < 32) throw new Error("ADMIN_JWT_SECRET must contain at least 32 characters");
    this.store = store;
    this.jwtSecret = jwtSecret;
    this.production = production;
    this.now = now;
    this.dummyHashPromise = bcrypt.hash("NotARealPassword!234", 12);
  }

  async initialize() {
    const data = this.store.snapshot();
    if (Array.isArray(data.admins) && Array.isArray(data.adminSessions) && Array.isArray(data.adminAuditLogs) && Array.isArray(data.adminLoginAttempts)) return;
    await this.store.mutate(database => {
      database.admins ||= [];
      database.adminSessions ||= [];
      database.adminAuditLogs ||= [];
      database.adminLoginAttempts ||= [];
    });
  }

  cookie(token, remember = false) {
    const parts = [
      `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      remember ? "Max-Age=2592000" : "Max-Age=28800"
    ];
    if (this.production) parts.push("Secure");
    return parts.join("; ");
  }

  clearCookie() {
    return `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${this.production ? "; Secure" : ""}`;
  }

  clientMeta(request) {
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return {
      ipAddress: safeText(forwarded || request.socket?.remoteAddress || "unknown", 80),
      userAgent: safeText(request.headers["user-agent"] || "unknown", 260)
    };
  }

  nextAdminId(database) {
    const maximum = database.admins.reduce((highest, admin) => {
      const number = Number(String(admin.adminId || "").match(/(\d+)$/)?.[1] || 0);
      return Math.max(highest, number);
    }, 0);
    return `SL-ADMIN-${String(maximum + 1).padStart(3, "0")}`;
  }

  permissionsFor(role, requested) {
    if (role === "super_admin") return [...ADMIN_PERMISSIONS];
    if (role === "receptionist") return [...ROLE_DEFAULT_PERMISSIONS.receptionist];
    const allowed = new Set(ADMIN_PERMISSIONS);
    const source = Array.isArray(requested) ? requested : ROLE_DEFAULT_PERMISSIONS[role] || [];
    return [...new Set(source.filter(permission => allowed.has(permission)))];
  }

  async audit(action, { admin, adminId, target, details, ipAddress, userAgent } = {}) {
    await this.store.mutate(database => {
      database.adminAuditLogs ||= [];
      database.adminAuditLogs.unshift({
        id: randomUUID(),
        adminId: admin?.adminId || adminId || "anonymous",
        adminName: admin?.fullName || null,
        action,
        target: safeText(target || "", 160) || null,
        details: details && typeof details === "object"
          ? Object.fromEntries(Object.entries(details).map(([key, value]) => [safeText(key, 50), safeText(value, 180)]))
          : null,
        ipAddress: safeText(ipAddress || "unknown", 80),
        userAgent: safeText(userAgent || "unknown", 260),
        createdAt: nowIso()
      });
      database.adminAuditLogs = database.adminAuditLogs.slice(0, 5000);
    });
  }

  async createFirstSuperAdmin(input, meta = {}) {
    await this.initialize();
    if (this.store.snapshot().admins.length) {
      throw new AdminAuthError(409, "SUPER_ADMIN_EXISTS", "An administrator account already exists");
    }
    return this.createAdmin({ ...input, role: "super_admin", permissions: ADMIN_PERMISSIONS }, {
      actor: { adminId: "SYSTEM", fullName: "Initial setup", role: "super_admin", permissions: ADMIN_PERMISSIONS },
      meta,
      allowFirst: true
    });
  }

  async createAdmin(input, { actor, meta = {}, allowFirst = false } = {}) {
    if (!allowFirst && actor?.role !== "super_admin") throw new AdminAuthError(403, "FORBIDDEN", "Super Admin access required");
    const parsed = adminSchema.safeParse(input);
    if (!parsed.success) throw new AdminAuthError(422, "VALIDATION_ERROR", "Check the administrator details", parsed.error.flatten());
    const temporaryPassword = parsed.data.password || passwordFromRandomBytes();
    const email = normalizeIdentifier(parsed.data.email);
    const mobile = parsed.data.mobile.replace(/[^\d+]/g, "");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const assignedDoctorIds = [...new Set(parsed.data.assignedDoctorIds || [])];
    if (parsed.data.role === "receptionist" && assignedDoctorIds.length === 0) {
      throw new AdminAuthError(422, "DOCTOR_ASSIGNMENT_REQUIRED", "Assign at least one verified doctor to this receptionist");
    }
    let created;

    await this.store.mutate(database => {
      database.admins ||= [];
      if (database.admins.some(admin => normalizeIdentifier(admin.email) === email)) {
        throw new AdminAuthError(409, "DUPLICATE_EMAIL", "An administrator with this email already exists");
      }
      const verifiedDoctorIds = new Set((database.doctors || [])
        .filter(doctor => doctor.verified === true || String(doctor.status).toLowerCase() === "verified")
        .map(doctor => doctor.id));
      if (assignedDoctorIds.some(id => !verifiedDoctorIds.has(id))) {
        throw new AdminAuthError(422, "INVALID_DOCTOR_ASSIGNMENT", "Receptionists can only be assigned to verified doctors");
      }
      const adminId = this.nextAdminId(database);
      created = {
        id: randomUUID(),
        adminId,
        fullName: parsed.data.fullName,
        email,
        mobile,
        passwordHash,
        role: parsed.data.role,
        permissions: this.permissionsFor(parsed.data.role, parsed.data.permissions),
        assignedDoctorIds,
        status: "active",
        mustChangePassword: true,
        tokenVersion: 1,
        createdAt: nowIso(),
        lastLogin: null,
        createdBy: actor?.adminId || "SYSTEM"
      };
      database.admins.push(created);
    });
    await this.audit("admin.account.created", {
      admin: actor,
      target: created.adminId,
      details: { role: created.role },
      ...meta
    });
    return { admin: publicAdmin(created), temporaryPassword };
  }

  lockState(database, identifier, ipAddress) {
    const windowStart = this.now() - 15 * 60 * 1000;
    const attempts = (database.adminLoginAttempts || []).filter(attempt =>
      Date.parse(attempt.createdAt) >= windowStart
      && (attempt.identifier === identifier || attempt.ipAddress === ipAddress)
    );
    if (attempts.length < 5) return null;
    const unlockAt = Date.parse(attempts[0].createdAt) + 15 * 60 * 1000;
    return unlockAt > this.now() ? new Date(unlockAt).toISOString() : null;
  }

  async recordFailedLogin(identifier, admin, meta) {
    await this.store.mutate(database => {
      database.adminLoginAttempts ||= [];
      database.adminLoginAttempts.unshift({
        id: randomUUID(),
        identifier,
        adminId: admin?.adminId || null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        createdAt: nowIso()
      });
      const keepAfter = this.now() - 24 * 60 * 60 * 1000;
      database.adminLoginAttempts = database.adminLoginAttempts
        .filter(attempt => Date.parse(attempt.createdAt) >= keepAfter)
        .slice(0, 2000);
    });
    await this.audit("admin.login.failed", {
      adminId: admin?.adminId || "unknown",
      target: admin?.adminId || null,
      details: { reason: "invalid_credentials" },
      ...meta
    });
  }

  async login(input, meta) {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) throw new AdminAuthError(422, "VALIDATION_ERROR", "Enter a valid Admin ID or email and password");
    const identifier = normalizeIdentifier(parsed.data.identifier);
    const database = this.store.snapshot();
    const unlockAt = this.lockState(database, identifier, meta.ipAddress);
    if (unlockAt) throw new AdminAuthError(429, "TOO_MANY_ATTEMPTS", "Too many login attempts. Try again later.", { unlockAt });

    const admin = database.admins.find(item =>
      normalizeIdentifier(item.adminId) === identifier || normalizeIdentifier(item.email) === identifier
    );
    const passwordMatches = await bcrypt.compare(parsed.data.password, admin?.passwordHash || await this.dummyHashPromise);
    if (!admin || !passwordMatches) {
      await this.recordFailedLogin(identifier, admin, meta);
      throw new AdminAuthError(401, "INVALID_CREDENTIALS", "Invalid Admin ID/email or password");
    }
    if (admin.status !== "active") {
      await this.audit("admin.login.failed", { admin, details: { reason: "account_disabled" }, ...meta });
      throw new AdminAuthError(403, "ACCOUNT_DISABLED", "This administrator account is disabled");
    }

    const remember = Boolean(parsed.data.remember);
    const sessionId = randomUUID();
    const csrfToken = randomBytes(24).toString("base64url");
    const expiresAt = new Date(this.now() + (remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000)).toISOString();
    const token = jwt.sign(
      { sub: admin.id, sid: sessionId, ver: admin.tokenVersion, type: "admin" },
      this.jwtSecret,
      { algorithm: "HS256", expiresIn: remember ? "30d" : "8h", issuer: "sehatline-admin", audience: "sehatline-admin-panel" }
    );
    await this.store.mutate(data => {
      data.adminSessions ||= [];
      data.adminSessions.push({
        id: sessionId,
        adminId: admin.id,
        tokenVersion: admin.tokenVersion,
        csrfToken,
        createdAt: nowIso(),
        expiresAt,
        revokedAt: null,
        remember,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      });
      data.adminSessions = data.adminSessions
        .filter(session => !session.revokedAt && Date.parse(session.expiresAt) > this.now())
        .slice(-1000);
      const storedAdmin = data.admins.find(item => item.id === admin.id);
      storedAdmin.lastLogin = nowIso();
      data.adminLoginAttempts = (data.adminLoginAttempts || []).filter(attempt =>
        attempt.identifier !== identifier && attempt.adminId !== admin.adminId
      );
    });
    await this.audit("admin.login.succeeded", { admin, ...meta });
    return { admin: publicAdmin(admin), token, csrfToken, remember };
  }

  async authenticate(request) {
    const token = parseCookies(request.headers.cookie)[ADMIN_COOKIE_NAME];
    if (!token) throw new AdminAuthError(401, "AUTH_REQUIRED", "Administrator login required");
    let claims;
    try {
      claims = jwt.verify(token, this.jwtSecret, {
        algorithms: ["HS256"],
        issuer: "sehatline-admin",
        audience: "sehatline-admin-panel"
      });
    } catch {
      throw new AdminAuthError(401, "SESSION_EXPIRED", "Your admin session has expired");
    }
    const database = this.store.snapshot();
    const session = (database.adminSessions || []).find(item => item.id === claims.sid && !item.revokedAt);
    const admin = (database.admins || []).find(item => item.id === claims.sub);
    if (!session || Date.parse(session.expiresAt) <= this.now() || !admin || admin.status !== "active"
      || admin.tokenVersion !== claims.ver || session.tokenVersion !== admin.tokenVersion) {
      throw new AdminAuthError(401, "SESSION_EXPIRED", "Your admin session has expired");
    }
    return { admin, session, claims, meta: this.clientMeta(request) };
  }

  requirePermission(auth, permission) {
    if (auth.admin.role === "super_admin") return;
    if (!auth.admin.permissions?.includes(permission)) {
      throw new AdminAuthError(403, "ACCESS_DENIED", "You do not have permission to access this module");
    }
  }

  verifyCsrf(request, auth) {
    const token = String(request.headers["x-admin-csrf"] || "");
    if (!token || token !== auth.session.csrfToken) throw new AdminAuthError(403, "CSRF_FAILED", "Security validation failed");
  }

  async logout(auth) {
    await this.store.mutate(database => {
      const session = database.adminSessions.find(item => item.id === auth.session.id);
      if (session) session.revokedAt = nowIso();
    });
    await this.audit("admin.logout", { admin: auth.admin, ...auth.meta });
  }

  async changePassword(auth, input) {
    const parsed = passwordChangeSchema.safeParse(input);
    if (!parsed.success) throw new AdminAuthError(422, "WEAK_PASSWORD", "New password does not meet the security requirements");
    const matches = await bcrypt.compare(parsed.data.currentPassword, auth.admin.passwordHash);
    if (!matches) throw new AdminAuthError(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
    const samePassword = await bcrypt.compare(parsed.data.newPassword, auth.admin.passwordHash);
    if (samePassword) throw new AdminAuthError(422, "PASSWORD_REUSED", "Choose a new password");
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await this.store.mutate(database => {
      const admin = database.admins.find(item => item.id === auth.admin.id);
      admin.passwordHash = passwordHash;
      admin.mustChangePassword = false;
      admin.tokenVersion += 1;
      admin.passwordChangedAt = nowIso();
      database.adminSessions.forEach(session => {
        if (session.adminId === admin.id) session.revokedAt = nowIso();
      });
    });
    await this.audit("admin.password.changed", { admin: auth.admin, ...auth.meta });
  }

  listAdmins() {
    return this.store.snapshot().admins.map(publicAdmin);
  }

  listAuditLogs(limit = 200) {
    return (this.store.snapshot().adminAuditLogs || []).slice(0, Math.min(Math.max(Number(limit) || 200, 1), 500));
  }

  async updateAdmin(actorAuth, targetId, input) {
    let updated;
    await this.store.mutate(database => {
      const admin = database.admins.find(item => item.id === targetId || item.adminId === targetId);
      if (!admin) return;
      if (input.email && normalizeIdentifier(input.email) !== admin.email
        && database.admins.some(item => item.id !== admin.id && normalizeIdentifier(item.email) === normalizeIdentifier(input.email))) {
        throw new AdminAuthError(409, "DUPLICATE_EMAIL", "An administrator with this email already exists");
      }
      if (input.fullName != null) admin.fullName = safeText(input.fullName, 100);
      if (input.email != null) admin.email = normalizeIdentifier(input.email);
      if (input.mobile != null) admin.mobile = String(input.mobile).replace(/[^\d+]/g, "").slice(0, 20);
      if (input.assignedDoctorIds != null) {
        const assignedDoctorIds = [...new Set((Array.isArray(input.assignedDoctorIds) ? input.assignedDoctorIds : []).map(id => safeText(id, 160)).filter(Boolean))];
        const verifiedDoctorIds = new Set((database.doctors || [])
          .filter(doctor => doctor.verified === true || String(doctor.status).toLowerCase() === "verified")
          .map(doctor => doctor.id));
        if (assignedDoctorIds.some(id => !verifiedDoctorIds.has(id))) {
          throw new AdminAuthError(422, "INVALID_DOCTOR_ASSIGNMENT", "Receptionists can only be assigned to verified doctors");
        }
        admin.assignedDoctorIds = assignedDoctorIds;
      }
      if (input.role != null) {
        if (!ADMIN_ROLES.includes(input.role)) throw new AdminAuthError(422, "VALIDATION_ERROR", "Invalid administrator role");
        if (admin.role === "super_admin" && input.role !== "super_admin"
          && database.admins.filter(item => item.role === "super_admin" && item.status === "active").length <= 1) {
          throw new AdminAuthError(422, "LAST_SUPER_ADMIN", "Create another active Super Admin before changing this role");
        }
        admin.role = input.role;
      }
      if (admin.role === "receptionist" && !(admin.assignedDoctorIds || []).length) {
        throw new AdminAuthError(422, "DOCTOR_ASSIGNMENT_REQUIRED", "Assign at least one verified doctor to this receptionist");
      }
      if (input.permissions != null || input.role != null) admin.permissions = this.permissionsFor(admin.role, input.permissions);
      admin.updatedAt = nowIso();
      updated = publicAdmin(admin);
    });
    if (!updated) throw new AdminAuthError(404, "ADMIN_NOT_FOUND", "Administrator not found");
    await this.audit("admin.account.updated", {
      admin: actorAuth.admin,
      target: updated.adminId,
      details: { role: updated.role, permissions: updated.permissions.join(",") },
      ...actorAuth.meta
    });
    return updated;
  }

  async setStatus(actorAuth, targetId, status) {
    if (!["active", "disabled"].includes(status)) throw new AdminAuthError(422, "VALIDATION_ERROR", "Invalid account status");
    let updated;
    await this.store.mutate(database => {
      const admin = database.admins.find(item => item.id === targetId || item.adminId === targetId);
      if (!admin) return;
      if (admin.id === actorAuth.admin.id && status === "disabled") {
        throw new AdminAuthError(422, "SELF_DISABLE_BLOCKED", "You cannot disable your own account");
      }
      if (admin.role === "super_admin" && status === "disabled"
        && database.admins.filter(item => item.role === "super_admin" && item.status === "active").length <= 1) {
        throw new AdminAuthError(422, "LAST_SUPER_ADMIN", "The last active Super Admin cannot be disabled");
      }
      admin.status = status;
      admin.tokenVersion += 1;
      admin.updatedAt = nowIso();
      database.adminSessions.forEach(session => {
        if (session.adminId === admin.id) session.revokedAt = nowIso();
      });
      updated = publicAdmin(admin);
    });
    if (!updated) throw new AdminAuthError(404, "ADMIN_NOT_FOUND", "Administrator not found");
    await this.audit(status === "disabled" ? "admin.account.disabled" : "admin.account.enabled", {
      admin: actorAuth.admin,
      target: updated.adminId,
      ...actorAuth.meta
    });
    return updated;
  }

  async resetPassword(actorAuth, targetId) {
    const temporaryPassword = passwordFromRandomBytes();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    let updated;
    await this.store.mutate(database => {
      const admin = database.admins.find(item => item.id === targetId || item.adminId === targetId);
      if (!admin) return;
      admin.passwordHash = passwordHash;
      admin.mustChangePassword = true;
      admin.tokenVersion += 1;
      admin.passwordResetAt = nowIso();
      database.adminSessions.forEach(session => {
        if (session.adminId === admin.id) session.revokedAt = nowIso();
      });
      updated = publicAdmin(admin);
    });
    if (!updated) throw new AdminAuthError(404, "ADMIN_NOT_FOUND", "Administrator not found");
    await this.audit("admin.password.reset", { admin: actorAuth.admin, target: updated.adminId, ...actorAuth.meta });
    return { admin: updated, temporaryPassword };
  }
}

export function adminErrorPayload(error) {
  if (!(error instanceof AdminAuthError)) return null;
  return {
    statusCode: error.statusCode,
    payload: {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    }
  };
}

export { PASSWORD_PATTERN, publicAdmin };
