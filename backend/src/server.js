import http from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { JsonStore, MongoStore } from "./store.js";
import { connectDatabase } from "./config/database.js";
import { AdminAuthService, adminErrorPayload } from "./admin-auth.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(sourceDirectory, "../..");

async function loadLocalEnvironment() {
  try {
    const file = await readFile(path.join(projectRoot, ".env.local"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] != null) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnvironment();

const DEFAULT_PORT = Number(process.env.PORT || 4000);
const MAX_BODY_BYTES = 1_000_000;

let aiRecommend;
try {
  ({ recommend: aiRecommend } = await import("../../ai_service/src/recommendation.js"));
} catch {
  aiRecommend = fallbackRecommendation;
}

const identitySessions = new Map();
const identitySandboxEnabled = process.env.NODE_ENV !== "production"
  && process.env.SEHATLINE_IDENTITY_SANDBOX !== "false";
const otpSandboxEnabled = process.env.NODE_ENV !== "production"
  && process.env.SEHATLINE_OTP_SANDBOX === "true";
const msg91AuthKey = String(process.env.MSG91_AUTH_KEY || "").trim();
const msg91TemplateId = String(process.env.MSG91_TEMPLATE_ID || "").trim();
const msg91WidgetId = String(process.env.MSG91_WIDGET_ID || "").trim();
const msg91WidgetToken = String(process.env.MSG91_WIDGET_TOKEN || "").trim();
const msg91SendOtpConfigured = Boolean(msg91AuthKey && msg91TemplateId);
const msg91WidgetConfigured = Boolean(msg91AuthKey && msg91WidgetId && msg91WidgetToken);
const otpSendTimes = new Map();

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".mp4", "video/mp4"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".pdf", "application/pdf"]
]);

const apiReference = {
  name: "SehatLine MVP API",
  version: "0.1.0",
  endpoints: [
    "GET /api/health",
    "GET|POST /api/doctors",
    "GET|PUT|PATCH|DELETE /api/doctors/:id",
    "POST /api/doctors/:id/verify",
    "POST /api/doctors/:id/reject",
    "GET|POST /api/labs",
    "GET|PUT|PATCH /api/labs/:id",
    "POST /api/labs/:id/verify",
    "GET|POST /api/bookings",
    "GET|POST /api/appointments",
    "GET|PATCH|PUT|DELETE /api/bookings/:id",
    "GET /api/reports",
    "GET /api/users",
    "GET|POST /api/notifications",
    "GET /api/admin/overview",
    "GET /api/auth/otp/config",
    "POST /api/auth/verify-widget-token",
    "POST /api/auth/patient/identity/start",
    "POST /api/auth/patient/identity/complete",
    "POST /api/ai/query",
    "POST /api/ai/recommend",
    "GET|PUT /api/doctor/profile",
    "GET|POST /api/doctor/appointments",
    "GET /api/doctor/dashboard",
    "GET|POST|PATCH /api/doctor/queue",
    "GET /api/doctor/patients",
    "GET /api/doctor/analytics"
  ]
};

const titleCase = value => String(value || "").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const slugId = prefix => `${prefix}-${randomUUID().slice(0, 8)}`;
const asArray = value => Array.isArray(value) ? value : value == null || value === "" ? [] : String(value).split(",").map(item => item.trim()).filter(Boolean);
const numeric = (value, fallback = 0) => {
  if (value == null || value === "") return fallback;
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
};
const optionalNumber = value => {
  if (value == null || value === "") return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};
const firstText = (...values) => {
  const value = values.find(item => item != null && String(item).trim());
  return value == null ? "" : String(value).trim();
};
const verified = item => {
  const status = String(item?.status || "").toLowerCase();
  return status ? status === "verified" : item?.verified === true;
};
const jsonClone = value => JSON.parse(JSON.stringify(value));
const displayTimeAgo = () => "Just now";
const phoneDigits = value => String(value || "").replace(/\D/g, "").slice(-10);

async function providerJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

async function sendMsg91Otp(phone) {
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", msg91TemplateId);
  url.searchParams.set("mobile", `91${phone}`);
  url.searchParams.set("authkey", msg91AuthKey);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  const payload = await providerJson(response);
  if (!response.ok || payload.type !== "success") {
    throw new Error(firstText(payload.message, "MSG91 could not deliver the OTP"));
  }
  return payload;
}

async function verifyMsg91Otp(phone, otp) {
  const url = new URL("https://control.msg91.com/api/v5/otp/verify");
  url.searchParams.set("mobile", `91${phone}`);
  url.searchParams.set("otp", otp);
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      authkey: msg91AuthKey
    }
  });
  const payload = await providerJson(response);
  const verified = response.ok
    && (payload.type === "success" || /verified success/i.test(String(payload.message || "")));
  if (!verified) throw new Error(firstText(payload.message, "The OTP is invalid or expired"));
  return payload;
}

function decodeJwtPayload(token) {
  try {
    const encoded = String(token || "").split(".")[1];
    if (!encoded) return {};
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

function widgetIdentifier(payload, accessToken) {
  const claims = decodeJwtPayload(accessToken);
  return firstText(
    payload?.identifier,
    payload?.mobile,
    payload?.phone,
    payload?.data?.identifier,
    payload?.data?.mobile,
    payload?.data?.phone,
    claims.identifier,
    claims.mobile,
    claims.phone
  );
}

async function verifyMsg91WidgetAccessToken(accessToken, providerFetch = fetch) {
  const response = await providerFetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authkey: msg91AuthKey,
      "access-token": accessToken
    })
  });
  const payload = await providerJson(response);
  const message = String(payload?.message || "");
  const tokenVerified = response.ok && (
    payload?.type === "success"
    || payload?.success === true
    || (/verified|valid/i.test(message) && !/invalid|failed|expired/i.test(message))
  );
  if (!tokenVerified) {
    throw new Error(firstText(payload?.message, "MSG91 could not verify this OTP session"));
  }
  return payload;
}

function hasRawIdentityData(input = {}) {
  const forbiddenKeys = new Set([
    "aadhaar",
    "aadhaarnumber",
    "uid",
    "vid",
    "face",
    "faceimage",
    "biometric",
    "selfie",
    "photo"
  ]);
  const inspect = value => {
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, nested]) =>
      forbiddenKeys.has(key.toLowerCase().replace(/[^a-z]/g, "")) || inspect(nested)
    );
  };
  return inspect(input);
}

function normalizeDoctor(input, current = {}) {
  const merged = { ...current, ...input };
  const name = firstText(merged.name, merged.fullName);
  const specialty = firstText(merged.specialty, merged.specialization, merged.specialisation);
  const qualification = firstText(merged.qualification, merged.degree);
  const phone = firstText(merged.phone, merged.phoneNumber, merged.mobile, merged.mobileNumber);
  const clinic = firstText(merged.clinic, merged.clinicName);
  const address = firstText(merged.address, merged.clinicAddress, merged.location);
  const location = firstText(merged.location, merged.address, merged.clinicAddress);
  const registrationNumber = firstText(
    merged.registrationNumber,
    merged.medicalRegistrationNumber,
    merged.licenseNumber,
    merged.licenceNumber
  );
  const registrationCouncil = firstText(
    merged.registrationCouncil,
    merged.medicalCouncil,
    merged.council,
    merged.licenseCouncil,
    merged.licenceCouncil
  );
  const fee = optionalNumber(merged.fee ?? merged.consultationFee);
  const experience = optionalNumber(merged.experience ?? merged.experienceYears);
  const requestedStatus = String(merged.status || (merged.verified ? "verified" : "pending")).toLowerCase();
  const status = ["pending", "verified", "rejected"].includes(requestedStatus) ? requestedStatus : "pending";
  const now = new Date().toISOString();
  return {
    ...merged,
    id: current.id || merged.id || slugId("doc"),
    name,
    initials: merged.initials || (name ? name.replace(/^Dr\.\s*/i, "").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() : ""),
    specialty,
    specialization: specialty,
    qualification,
    phone,
    experience,
    fee,
    consultationFee: fee,
    rating: numeric(merged.rating),
    reviews: numeric(merged.reviews),
    distance: numeric(merged.distance, 0),
    gender: merged.gender || "Not specified",
    languages: asArray(merged.languages).length ? asArray(merged.languages) : (status === "verified" ? ["Hindi", "English"] : []),
    availability: merged.availability || (status === "verified" ? "Contact clinic" : "Pending verification"),
    nextSlot: merged.nextSlot || "Contact clinic",
    clinic,
    address,
    location,
    registrationNumber,
    registrationCouncil,
    avgWait: merged.avgWait || "Not available",
    colors: Array.isArray(merged.colors) && merged.colors.length >= 3 ? merged.colors : ["#d1fae5", "#bfdbfe", "#155e75"],
    services: asArray(merged.services).length ? asArray(merged.services) : ["Clinic consultation"],
    education: merged.education || qualification,
    status,
    verified: status === "verified",
    createdAt: merged.createdAt || now,
    appliedAt: merged.appliedAt || merged.createdAt || now,
    updatedAt: now
  };
}

const doctorWorkflowFields = new Set([
  "status",
  "verified",
  "verifiedAt",
  "verifiedBy",
  "approvedAt",
  "approvedBy",
  "approvalNote",
  "rejectedAt",
  "rejectedBy",
  "rejectionReason",
  "reviewedAt",
  "verification",
  "verificationHistory"
]);

function withoutDoctorWorkflowFields(input) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !doctorWorkflowFields.has(key)));
}

const doctorProfileFields = new Set([
  "name",
  "fullName",
  "specialty",
  "specialization",
  "specialisation",
  "qualification",
  "degree",
  "phone",
  "phoneNumber",
  "mobile",
  "mobileNumber",
  "email",
  "clinic",
  "clinicName",
  "address",
  "clinicAddress",
  "location",
  "city",
  "pincode",
  "registrationNumber",
  "medicalRegistrationNumber",
  "licenseNumber",
  "licenceNumber",
  "registrationCouncil",
  "medicalCouncil",
  "council",
  "licenseCouncil",
  "licenceCouncil",
  "fee",
  "consultationFee",
  "experience",
  "experienceYears",
  "gender",
  "languages",
  "documents",
  "registrationCertificateName",
  "registrationCertificateUrl",
  "degreeCertificateName",
  "degreeCertificateUrl",
  "photoIdName",
  "photoIdUrl",
  "registrationDocumentUrl",
  "licenseDocumentUrl",
  "applicationSource",
  "about",
  "photo",
  "photoUrl",
  "profilePhoto",
  "avatar",
  "avatarUrl",
  "availability",
  "nextSlot",
  "services",
  "education",
  "onlineConsultation",
  "homeVisit",
  "coordinates",
  "latitude",
  "longitude"
]);

function sanitizeDoctorProfileInput(input) {
  return Object.fromEntries(
    Object.entries(withoutDoctorWorkflowFields(input))
      .filter(([key]) => doctorProfileFields.has(key))
  );
}

function missingDoctorVerificationFields(doctor) {
  const missing = [];
  const hasText = value => typeof value === "string" && value.trim().length > 0;
  const hasNumber = value => value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
  const hasValidPhone = value => hasText(value) && /^\d{10,15}$/.test(value.replace(/\D/g, ""));
  const hasValidEmail = value => hasText(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const hasValidUrl = value => {
    try {
      return ["http:", "https:"].includes(new URL(String(value || "")).protocol);
    } catch {
      return false;
    }
  };
  const requireDocument = (key, label) => {
    const document = doctor.documents?.[key] || {};
    if (!hasText(document.name)) missing.push(`documents.${label}.name`);
    if (!hasValidUrl(document.url)) missing.push(`documents.${label}.url`);
  };

  if (!hasText(doctor.name)) missing.push("name");
  if (!hasValidPhone(doctor.phone)) missing.push("phone");
  if (!hasValidEmail(doctor.email)) missing.push("email");
  if (!hasText(doctor.specialty)) missing.push("specialty");
  if (!hasText(doctor.qualification) || doctor.qualification === "Qualification verification pending") missing.push("qualification");
  if (!hasNumber(doctor.experience)) missing.push("experience");
  if (!hasNumber(doctor.fee)) missing.push("fee");
  if (!hasText(doctor.clinic)) missing.push("clinic");
  if (!hasText(doctor.address) && !hasText(doctor.location)) missing.push("address/location");
  if (!hasText(doctor.city)) missing.push("city");
  if (!/^[1-9]\d{5}$/.test(String(doctor.pincode || ""))) missing.push("pincode");
  if (!Array.isArray(doctor.languages) || doctor.languages.length === 0) missing.push("languages");
  if (!hasText(doctor.registrationNumber)) missing.push("registrationNumber");
  if (!hasText(doctor.registrationCouncil)) missing.push("registrationCouncil");
  requireDocument("registrationCertificate", "registrationCertificate");
  requireDocument("degreeCertificate", "degreeCertificate");
  requireDocument("photoId", "photoId");
  if (doctor.applicationSource === "doctor-app" && !hasText(doctor.declarationAcceptedAt)) {
    missing.push("declarationAcceptedAt");
  }
  return missing;
}

const publicDoctorFields = [
  "id",
  "name",
  "initials",
  "specialty",
  "specialization",
  "qualification",
  "experience",
  "fee",
  "consultationFee",
  "rating",
  "reviews",
  "distance",
  "gender",
  "languages",
  "availability",
  "nextSlot",
  "clinic",
  "address",
  "location",
  "avgWait",
  "colors",
  "services",
  "education",
  "registrationNumber",
  "registrationCouncil",
  "about",
  "photo",
  "photoUrl",
  "profilePhoto",
  "avatar",
  "avatarUrl",
  "onlineConsultation",
  "homeVisit",
  "coordinates",
  "latitude",
  "longitude",
  "status",
  "verified",
  "verifiedAt",
  "updatedAt"
];

function publicDoctor(doctor) {
  return Object.fromEntries(
    publicDoctorFields
      .filter(field => doctor[field] !== undefined)
      .map(field => [field, doctor[field]])
  );
}

function normalizeLab(input, current = {}) {
  const merged = { ...current, ...input };
  const tests = Array.isArray(merged.tests) ? merged.tests.map((test, index) => ({
    ...test,
    id: test.id || slugId(`test${index + 1}`),
    name: test.name || "Diagnostic test",
    price: numeric(test.price),
    reportTime: test.reportTime || merged.reportTime || "Contact lab"
  })) : [];
  const featured = tests[0] || {};
  const status = String(merged.status || (merged.verified ? "verified" : "pending")).toLowerCase();
  return {
    ...merged,
    id: merged.id || slugId("lab"),
    name: String(merged.name || "Unnamed PathLab").trim(),
    location: merged.location || merged.address || "Prayagraj",
    address: merged.address || merged.location || "Prayagraj",
    rating: numeric(merged.rating),
    reviews: numeric(merged.reviews),
    distance: numeric(merged.distance),
    certified: merged.certified || merged.accreditation || "Verification pending",
    accreditation: merged.accreditation || merged.certified || "Verification pending",
    homeCollection: merged.homeCollection === true || merged.homeCollection === "true",
    reportTime: merged.reportTime || featured.reportTime || "Contact lab",
    test: merged.test || featured.name || "Test catalogue being updated",
    price: numeric(merged.price ?? featured.price),
    originalPrice: numeric(merged.originalPrice, numeric(merged.price ?? featured.price)),
    discount: numeric(merged.discount),
    nextSlot: merged.nextSlot || "Contact lab",
    tests,
    status,
    verified: status === "verified" || merged.verified === true,
    updatedAt: new Date().toISOString()
  };
}

function normalizeNotification(input) {
  const message = String(input.message || input.copy || "").trim();
  return {
    ...input,
    id: input.id || slugId("notification"),
    title: String(input.title || "SehatLine update").trim(),
    message,
    copy: message,
    audience: input.audience || "All patients",
    time: input.time || displayTimeAgo(),
    icon: input.icon || "bell",
    unread: input.unread ?? true,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function normalizeBooking(input, database) {
  const doctor = database.doctors.find(item => item.id === input.doctorId);
  const lab = database.labs.find(item => item.id === input.labId || item.id === input.providerId);
  const providerType = input.providerType || (lab ? "lab" : "doctor");
  const provider = providerType === "lab" ? lab : doctor;
  const dateValue = input.date || new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(`${dateValue}T12:00:00`);
  const validDate = !Number.isNaN(parsedDate.valueOf());
  const patientName = input.patientName || input.patient || input.patientDetails?.name || "Demo Patient";
  const amount = providerType === "lab"
    ? numeric(input.amount, numeric(input.price, numeric(lab?.price)))
    : numeric(doctor?.fee, numeric(input.amount));
  return {
    ...input,
    id: input.id || slugId(providerType === "lab" ? "lab-booking" : "appointment"),
    patientId: input.patientId || "u1",
    patientName,
    doctorId: providerType === "doctor" ? input.doctorId : undefined,
    doctorName: providerType === "doctor" ? doctor?.name || input.doctorName || "SehatLine doctor" : undefined,
    labId: providerType === "lab" ? lab?.id || input.labId || input.providerId : undefined,
    labName: providerType === "lab" ? lab?.name || input.labName || "SehatLine PathLab" : undefined,
    providerName: provider?.name || input.providerName || input.doctorName || input.labName || "SehatLine partner",
    providerType,
    date: validDate ? dateValue : new Date().toISOString().slice(0, 10),
    day: input.day || (validDate ? String(parsedDate.getDate()).padStart(2, "0") : ""),
    month: input.month || (validDate ? parsedDate.toLocaleString("en-IN", { month: "short" }) : ""),
    time: input.time || "To be confirmed",
    type: input.type || input.mode || (providerType === "lab" && input.homeCollection ? "Home collection" : "Clinic visit"),
    status: titleCase(input.status || "confirmed"),
    reason: input.reason || input.visitReason || input.test || "",
    amount,
    upcoming: input.upcoming ?? !["completed", "cancelled"].includes(String(input.status || "").toLowerCase()),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function doctorAppointmentFromBooking(booking, workspace) {
  const match = String(booking.time || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  const period = (match?.[3] || "PM").toUpperCase();
  const hour = match ? String(match[1]).padStart(2, "0") : "09";
  const minute = match?.[2] || "00";
  const sequence = workspace.appointments.length + 1;
  return {
    id: booking.id,
    time: `${hour}:${minute}`,
    period,
    name: booking.patientName,
    age: numeric(booking.patientAge),
    gender: booking.patientGender || "Not specified",
    phone: booking.patientPhone || "",
    token: booking.token || `A${String(sequence + 11).padStart(2, "0")}`,
    reason: booking.reason || "General consultation",
    type: booking.type || "New patient",
    status: String(booking.status || "confirmed").toLowerCase(),
    note: booking.note || "",
    date: booking.date
  };
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = payload == null ? "" : JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  response.end(body);
}

function sendError(response, statusCode, message, details) {
  sendJson(response, statusCode, { error: { message, ...(details ? { details } : {}) } });
}

function bearerToken(request) {
  const match = String(request.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function ensureDoctorQueue(database, doctorId, date = new Date().toISOString().slice(0, 10)) {
  database.queues ||= {};
  const queue = database.queues[doctorId] ||= {
    doctorId,
    date,
    status: "closed",
    capacity: 0,
    issued: 0,
    currentToken: "—",
    current: null,
    waiting: [],
    seen: 0,
    expectedMinutes: 15,
    delayMinutes: 0,
    updatedAt: new Date().toISOString()
  };
  if (queue.date !== date) {
    Object.assign(queue, { date, status: "closed", issued: 0, currentToken: "—", current: null, waiting: [] });
  }
  return queue;
}

function scheduleSlots(startTime, endTime, durationMinutes, capacity) {
  const parse = value => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  };
  const start = parse(startTime);
  const end = parse(endTime);
  const duration = Math.max(5, Number(durationMinutes) || 15);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const slots = [];
  for (let minute = start; minute + duration <= end && slots.length < Math.max(1, Number(capacity) || 100); minute += duration) {
    slots.push({ time: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`, available: true });
  }
  return slots;
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
  }
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function listDoctors(database, searchParams) {
  const includePending = searchParams.get("includePending") === "true";
  let list = database.doctors.filter(item => includePending || verified(item));
  const query = (searchParams.get("q") || searchParams.get("search") || "").toLowerCase();
  const status = (searchParams.get("status") || "").toLowerCase();
  const specialty = (searchParams.get("specialty") || "").toLowerCase();
  const gender = (searchParams.get("gender") || "").toLowerCase();
  const availability = (searchParams.get("availability") || "").toLowerCase();
  const maxFee = numeric(searchParams.get("maxFee"), Infinity);
  const maxDistance = numeric(searchParams.get("maxDistance"), Infinity);
  if (query) list = list.filter(item => `${item.name} ${item.specialty} ${item.clinic} ${item.location}`.toLowerCase().includes(query));
  if (status) list = list.filter(item => String(item.status).toLowerCase() === status);
  if (specialty) list = list.filter(item => item.specialty.toLowerCase().includes(specialty));
  if (gender) list = list.filter(item => item.gender.toLowerCase() === gender);
  if (availability) list = list.filter(item => item.availability.toLowerCase().includes(availability));
  list = list.filter(item => item.fee <= maxFee && item.distance <= maxDistance);
  return includePending ? list : list.map(publicDoctor);
}

function listLabs(database, searchParams) {
  const includePending = searchParams.get("includePending") === "true";
  let list = database.labs.filter(item => includePending || verified(item));
  const query = (searchParams.get("q") || searchParams.get("search") || searchParams.get("test") || "").toLowerCase();
  const homeOnly = searchParams.get("homeCollection") === "true";
  const maxPrice = numeric(searchParams.get("maxPrice"), Infinity);
  const maxDistance = numeric(searchParams.get("maxDistance"), Infinity);
  if (query) list = list.filter(item => `${item.name} ${item.test} ${item.location} ${(item.tests || []).map(test => test.name).join(" ")}`.toLowerCase().includes(query));
  if (homeOnly) list = list.filter(item => item.homeCollection);
  return list.filter(item => item.price <= maxPrice && item.distance <= maxDistance);
}

function calculateOverview(database) {
  const pendingDoctors = database.doctors.filter(item => {
    const status = String(item.status || "").toLowerCase();
    return status === "pending" || (!status && !verified(item));
  }).length;
  const rejectedDoctors = database.doctors.filter(item => String(item.status).toLowerCase() === "rejected").length;
  const pendingLabs = database.labs.filter(item => !verified(item)).length;
  return {
    users: database.users.length,
    totalUsers: database.users.length,
    doctors: database.doctors.filter(verified).length,
    totalDoctors: database.doctors.filter(verified).length,
    labs: database.labs.filter(verified).length,
    totalLabs: database.labs.filter(verified).length,
    bookings: database.bookings.length,
    totalBookings: database.bookings.length,
    pendingDoctors,
    rejectedDoctors,
    pendingLabs,
    revenue: database.bookings
      .filter(item => String(item.status).toLowerCase() !== "cancelled")
      .reduce((sum, item) => sum + numeric(item.amount), 0),
    activeCity: database.meta?.city || "Prayagraj"
  };
}

function fallbackRecommendation({ query = "", doctors = [], labs = [] }) {
  const normalized = query.toLowerCase();
  const emergency = /(severe chest|chest pain|breathing|faint|unconscious|सीने|सांस|बेहोश)/i.test(normalized);
  if (emergency) {
    return {
      type: "safety",
      intent: { emergency: true },
      results: [],
      resultIds: [],
      answer: "This may need urgent attention. If there is severe chest pain, breathing difficulty or fainting, call local emergency services or go to the nearest emergency department now.",
      warning: "Sehat AI is not a substitute for emergency care.",
      disclaimer: "Sehat AI does not diagnose or prescribe."
    };
  }
  const wantsLab = /\b(?:lab|labs|test|tests|thyroid|cbc|blood|vitamin|pathology|diagnostic)\b|जांच|खून/i.test(normalized);
  const candidates = wantsLab ? [...labs] : [...doctors];
  const gender = /(female|lady|महिला)/i.test(normalized) ? "Female" : /(male|पुरुष)/i.test(normalized) ? "Male" : null;
  const specialty = /(skin|derma|त्वचा)/i.test(normalized) ? "Dermatologist"
    : /(heart|cardio|दिल)/i.test(normalized) ? "Cardiologist"
    : /(child|pediatric|paediatric|बच्च)/i.test(normalized) ? "Paediatrician"
    : /(bone|joint|ortho|हड्डी)/i.test(normalized) ? "Orthopaedic" : null;
  const budget = numeric(normalized.match(/(?:₹|rs\.?|under|andar|अंदर)\s*(\d{2,5})/i)?.[1], Infinity);
  let matches = candidates.filter(item => verified(item));
  if (!wantsLab && gender) matches = matches.filter(item => item.gender === gender);
  if (!wantsLab && specialty) matches = matches.filter(item => item.specialty === specialty);
  matches = matches.filter(item => numeric(wantsLab ? item.price : item.fee) <= budget);
  matches.sort((a, b) => wantsLab ? a.price - b.price || b.rating - a.rating : b.rating - a.rating || a.fee - b.fee || a.distance - b.distance);
  const results = matches.slice(0, 3);
  return {
    type: wantsLab ? "lab" : "doctor",
    intent: { budget: Number.isFinite(budget) ? budget : null, gender, specialty },
    results,
    resultIds: results.map(item => item.id),
    answer: results.length
      ? `I found ${results.length} verified ${wantsLab ? "lab" : "doctor"} options matching your request. Compare price, distance and availability before booking.`
      : "I could not find an exact verified match. Try increasing your budget or distance.",
    disclaimer: "Sehat AI helps with discovery and comparison. It does not diagnose, prescribe or guarantee a provider."
  };
}

function updateQueue(queue, action, payload, database) {
  const now = new Date().toISOString();
  if (["start", "resume"].includes(action)) queue.status = "live";
  if (action === "pause") queue.status = "paused";
  if (action === "close") queue.status = "closed";
  if (action === "delay") queue.delayMinutes = numeric(payload.delayMinutes ?? payload.minutes, queue.delayMinutes || 0);
  if (action === "settings") queue.expectedMinutes = numeric(payload.expectedMinutes, queue.expectedMinutes || 15);
  if (action === "next") {
    const previous = queue.current;
    if (previous?.appointmentId) {
      const appointment = database.doctorWorkspace.appointments.find(item => item.id === previous.appointmentId);
      if (appointment) appointment.status = "completed";
    }
    queue.current = queue.waiting.shift() || null;
    queue.currentToken = queue.current?.token || "—";
    queue.seen = numeric(queue.seen) + (previous ? 1 : 0);
    if (queue.current?.appointmentId) {
      const appointment = database.doctorWorkspace.appointments.find(item => item.id === queue.current.appointmentId);
      if (appointment) appointment.status = "in-progress";
    }
    queue.waiting = queue.waiting.map((item, index) => ({ ...item, wait: Math.max(0, numeric(queue.expectedMinutes, 15) * (index + 1) + numeric(queue.delayMinutes)) }));
  }
  if (action === "notify") {
    database.notifications.unshift(normalizeNotification({
      title: "Clinic queue update",
      message: "Your doctor’s live queue has been updated. Check your latest token estimate.",
      audience: "Queue patients",
      icon: "activity"
    }));
  }
  queue.updatedAt = now;
  return queue;
}

async function routeApi(request, response, url, store, runtime = {}) {
  const { pathname, searchParams } = url;
  const method = request.method;
  const database = store.snapshot();
  const providerFetch = runtime.providerFetch || fetch;
  const useIdentitySandbox = runtime.identitySandboxEnabled ?? identitySandboxEnabled;
  const useOtpSandbox = runtime.otpSandboxEnabled ?? otpSandboxEnabled;
  const adminAuth = runtime.adminAuth;
  const doctorSessions = runtime.doctorSessions;

  const requireDoctor = () => {
    const doctorId = doctorSessions.get(bearerToken(request));
    if (!doctorId) throw Object.assign(new Error("Doctor login required"), { statusCode: 401 });
    return doctorId;
  };

  if (method === "OPTIONS") {
    sendJson(response, 204, null);
    return true;
  }

  if ((pathname === "/api/health" || pathname === "/health") && method === "GET") {
    sendJson(response, 200, {
      status: "ok",
      service: "sehatline-api",
      version: "0.1.0",
      city: database.meta?.city,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
    return true;
  }
  if (pathname === "/api/docs" && method === "GET") {
    sendJson(response, 200, apiReference);
    return true;
  }

  if (/^\/api\/doctors\/[^/]+$/.test(pathname) && ["PATCH", "PUT", "DELETE"].includes(method)) {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    adminAuth.requirePermission(auth, "doctor_management");
  }

  if (pathname === "/api/auth/otp/config" && method === "GET") {
    if (msg91WidgetConfigured) {
      sendJson(response, 200, {
        mode: "msg91-widget",
        widgetId: msg91WidgetId,
        tokenAuth: msg91WidgetToken
      });
    } else if (useOtpSandbox) {
      sendJson(response, 200, { mode: "local-sandbox" });
    } else {
      sendJson(response, 503, {
        mode: "unconfigured",
        error: { message: "Live SMS OTP is not configured" }
      });
    }
    return true;
  }

  if (pathname === "/api/admin/auth/login" && method === "POST") {
    const result = await adminAuth.login(await readJson(request), adminAuth.clientMeta(request));
    sendJson(response, 200, { admin: result.admin, csrfToken: result.csrfToken, mustChangePassword: result.admin.mustChangePassword }, { "Set-Cookie": adminAuth.cookie(result.token, result.remember) });
    return true;
  }
  if (pathname === "/api/admin/auth/me" && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    sendJson(response, 200, { admin: (await adminAuth.authenticate(request)).admin, csrfToken: auth.session.csrfToken });
    return true;
  }
  if (pathname === "/api/admin/auth/change-password" && method === "POST") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    await adminAuth.changePassword(auth, await readJson(request));
    sendJson(response, 200, { changed: true }, { "Set-Cookie": adminAuth.clearCookie() });
    return true;
  }
  if (pathname === "/api/admin/auth/logout" && method === "POST") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    await adminAuth.logout(auth);
    sendJson(response, 200, { loggedOut: true }, { "Set-Cookie": adminAuth.clearCookie() });
    return true;
  }
  if (pathname === "/api/admin/overview" && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    if (auth.admin.mustChangePassword) throw Object.assign(new Error("Password change required"), { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    adminAuth.requirePermission(auth, "dashboard");
    sendJson(response, 200, calculateOverview(database));
    return true;
  }

  if (pathname === "/api/uploads/profile-photo" && method === "POST") {
    const input = await readJson(request);
    const match = String(input.dataUrl || "").match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) { sendError(response, 422, "A valid profile image is required"); return true; }
    const uploadRoot = path.resolve(runtime.uploadRoot || process.env.SEHATLINE_UPLOAD_ROOT || path.join(projectRoot, "uploads"));
    await mkdir(uploadRoot, { recursive: true });
    const filename = `${String(input.role || "profile").replace(/[^a-z0-9-]/gi, "-")}-${randomUUID()}.${match[1] === "jpeg" ? "jpg" : match[1]}`;
    await writeFile(path.join(uploadRoot, filename), Buffer.from(match[2], "base64"));
    sendJson(response, 201, { url: `/uploads/${filename}` });
    return true;
  }
  if (pathname === "/api/location/reverse" && method === "POST") {
    const input = await readJson(request);
    let location = { city: database.meta?.city || "Prayagraj", state: "Uttar Pradesh", country: "India" };
    try {
      const providerResponse = await providerFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(input.latitude)}&lon=${encodeURIComponent(input.longitude)}`, { headers: { "User-Agent": "SehatLine/1.0" } });
      if (providerResponse.ok) {
        const payload = await providerResponse.json();
        location = { ...location, ...payload.address, displayName: payload.display_name };
      }
    } catch { /* location remains city default */ }
    sendJson(response, 200, location);
    return true;
  }
  const adminDataRoutes = new Map([
    ["/api/admin/doctors", ["doctor_management", "doctor_verification"]],
    ["/api/admin/labs", ["document_approval"]],
    ["/api/admin/bookings", ["live_queue"]],
    ["/api/admin/patients", ["patient_management"]],
    ["/api/admin/notifications", ["complaints_support"]]
  ]);
  if (adminDataRoutes.has(pathname) && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    if (auth.admin.mustChangePassword) throw Object.assign(new Error("Password change required"), { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    const permissions = adminDataRoutes.get(pathname);
    if (!permissions.some(permission => auth.admin.role === "super_admin" || auth.admin.permissions?.includes(permission))) {
      adminAuth.requirePermission(auth, permissions[0]);
    }
    const payload = pathname.endsWith("/doctors")
      ? listDoctors(database, new URLSearchParams("includePending=true"))
      : pathname.endsWith("/labs")
        ? database.labs
        : pathname.endsWith("/bookings")
          ? database.bookings
          : pathname.endsWith("/patients")
            ? database.users
            : database.notifications;
    sendJson(response, 200, payload);
    return true;
  }
  if (pathname === "/api/admin/users" && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.requirePermission(auth, "admin_management");
    sendJson(response, 200, adminAuth.listAdmins());
    return true;
  }
  if (pathname === "/api/admin/users" && method === "POST") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    adminAuth.requirePermission(auth, "admin_management");
    const created = await adminAuth.createAdmin(await readJson(request), { actor: auth.admin, meta: auth.meta });
    sendJson(response, 201, created);
    return true;
  }
  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)(?:\/(reset-password|status))?$/);
  if (adminUserMatch) {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    adminAuth.requirePermission(auth, "admin_management");
    const [, targetId, action] = adminUserMatch;
    if (action === "reset-password" && method === "POST") {
      sendJson(response, 200, await adminAuth.resetPassword(auth, targetId));
      return true;
    }
    if (action === "status" && method === "PATCH") {
      sendJson(response, 200, await adminAuth.setStatus(auth, targetId, (await readJson(request)).status));
      return true;
    }
    if (!action && method === "PATCH") {
      sendJson(response, 200, await adminAuth.updateAdmin(auth, targetId, await readJson(request)));
      return true;
    }
  }
  if (pathname === "/api/admin/audit-logs" && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.requirePermission(auth, "audit_logs");
    sendJson(response, 200, adminAuth.listAuditLogs(searchParams.get("limit")));
    return true;
  }

  if (pathname === "/api/doctors" && method === "GET") {
    sendJson(response, 200, listDoctors(database, searchParams));
    return true;
  }
  if (pathname === "/api/doctors" && method === "POST") {
    const input = await readJson(request);
    const now = new Date().toISOString();
    const profileInput = sanitizeDoctorProfileInput(input);
    const declarationAcceptedAt = firstText(input.verification?.declarationAcceptedAt, input.declarationAcceptedAt);
    const doctor = normalizeDoctor({
      ...profileInput,
      ...(declarationAcceptedAt ? { declarationAcceptedAt } : {}),
      status: "pending",
      verified: false,
      createdAt: now,
      appliedAt: now,
      verification: {
        status: "pending",
        submittedAt: now
      }
    });
    await store.mutate(data => data.doctors.unshift(doctor));
    sendJson(response, 201, doctor);
    return true;
  }
  const doctorMatch = pathname.match(/^\/api\/doctors\/([^/]+)$/);
  if (doctorMatch && method === "GET") {
    const doctor = database.doctors.find(item => item.id === decodeURIComponent(doctorMatch[1]));
    const includePending = searchParams.get("includePending") === "true";
    if (!doctor || (!verified(doctor) && !includePending)) sendError(response, 404, "Doctor not found");
    else sendJson(response, 200, includePending ? doctor : publicDoctor(doctor));
    return true;
  }
  if (doctorMatch && ["PUT", "PATCH"].includes(method)) {
    const input = sanitizeDoctorProfileInput(await readJson(request));
    let updated;
    await store.mutate(data => {
      const index = data.doctors.findIndex(item => item.id === decodeURIComponent(doctorMatch[1]));
      if (index < 0) return;
      updated = normalizeDoctor(input, data.doctors[index]);
      data.doctors[index] = updated;
    });
    if (!updated) sendError(response, 404, "Doctor not found");
    else sendJson(response, 200, updated);
    return true;
  }
  if (doctorMatch && method === "DELETE") {
    let removed = false;
    await store.mutate(data => {
      const index = data.doctors.findIndex(item => item.id === decodeURIComponent(doctorMatch[1]));
      if (index < 0) return;
      data.doctors.splice(index, 1);
      removed = true;
    });
    if (!removed) sendError(response, 404, "Doctor not found");
    else sendJson(response, 200, { deleted: true });
    return true;
  }
  const doctorVerifyMatch = pathname.match(/^\/api\/doctors\/([^/]+)\/verify$/);
  if (doctorVerifyMatch && method === "POST") {
    const input = await readJson(request);
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    adminAuth.requirePermission(auth, "doctor_verification");
    let updated;
    await store.mutate(data => {
      const doctor = data.doctors.find(item => item.id === decodeURIComponent(doctorVerifyMatch[1]));
      if (!doctor) return;
      const missing = missingDoctorVerificationFields(doctor);
      if (missing.length) {
        updated = { validationError: missing };
        return;
      }
      const now = new Date().toISOString();
      const approvedBy = auth.admin.adminId;
      const approvalNote = firstText(input.approvalNote, input.verificationNote, input.note);
      doctor.status = "verified";
      doctor.verified = true;
      doctor.verifiedAt = now;
      doctor.verifiedBy = approvedBy;
      doctor.approvedAt = now;
      doctor.approvedBy = approvedBy;
      doctor.approvalNote = approvalNote;
      doctor.reviewedAt = now;
      doctor.updatedAt = now;
      doctor.verification = {
        status: "verified",
        decision: "approved",
        reviewedAt: now,
        reviewer: approvedBy,
        note: approvalNote
      };
      doctor.verificationHistory = [
        ...(Array.isArray(doctor.verificationHistory) ? doctor.verificationHistory : []),
        {
          decision: "approved",
          at: now,
          reviewedBy: approvedBy,
          note: approvalNote
        }
      ];
      delete doctor.rejectedAt;
      delete doctor.rejectedBy;
      delete doctor.rejectionReason;
      updated = doctor;
    });
    if (!updated) sendError(response, 404, "Doctor not found");
    else if (updated.validationError) sendError(response, 422, "Doctor profile is incomplete", updated.validationError);
    else sendJson(response, 200, updated);
    return true;
  }
  const doctorRejectMatch = pathname.match(/^\/api\/doctors\/([^/]+)\/reject$/);
  if (doctorRejectMatch && method === "POST") {
    const input = await readJson(request);
    const reason = firstText(input.reason, input.rejectionReason);
    if (!reason) {
      sendError(response, 422, "A rejection reason is required", ["reason"]);
      return true;
    }
    let updated;
    await store.mutate(data => {
      const doctor = data.doctors.find(item => item.id === decodeURIComponent(doctorRejectMatch[1]));
      if (!doctor) return;
      const now = new Date().toISOString();
      const rejectedBy = firstText(input.rejectedBy, input.reviewer) || null;
      doctor.status = "rejected";
      doctor.verified = false;
      doctor.rejectedAt = now;
      doctor.rejectedBy = rejectedBy;
      doctor.rejectionReason = reason;
      doctor.reviewedAt = now;
      doctor.updatedAt = now;
      doctor.verification = {
        status: "rejected",
        decision: "rejected",
        reviewedAt: now,
        reviewer: rejectedBy,
        reason
      };
      doctor.verificationHistory = [
        ...(Array.isArray(doctor.verificationHistory) ? doctor.verificationHistory : []),
        {
          decision: "rejected",
          at: now,
          reviewedBy: rejectedBy,
          reason
        }
      ];
      delete doctor.verifiedAt;
      delete doctor.verifiedBy;
      delete doctor.approvedAt;
      delete doctor.approvedBy;
      delete doctor.approvalNote;
      updated = doctor;
    });
    if (!updated) sendError(response, 404, "Doctor not found");
    else sendJson(response, 200, updated);
    return true;
  }

  if (pathname === "/api/labs" && method === "GET") {
    sendJson(response, 200, listLabs(database, searchParams));
    return true;
  }
  if (pathname === "/api/labs" && method === "POST") {
    const input = await readJson(request);
    const lab = normalizeLab({ ...input, status: "pending", verified: false });
    await store.mutate(data => data.labs.unshift(lab));
    sendJson(response, 201, lab);
    return true;
  }
  const labMatch = pathname.match(/^\/api\/labs\/([^/]+)$/);
  if (labMatch && method === "GET") {
    const lab = database.labs.find(item => item.id === decodeURIComponent(labMatch[1]));
    if (!lab || (!verified(lab) && searchParams.get("includePending") !== "true")) sendError(response, 404, "PathLab not found");
    else sendJson(response, 200, lab);
    return true;
  }
  if (labMatch && ["PUT", "PATCH"].includes(method)) {
    const input = await readJson(request);
    let updated;
    await store.mutate(data => {
      const index = data.labs.findIndex(item => item.id === decodeURIComponent(labMatch[1]));
      if (index < 0) return;
      updated = normalizeLab(input, data.labs[index]);
      data.labs[index] = updated;
    });
    if (!updated) sendError(response, 404, "PathLab not found");
    else sendJson(response, 200, updated);
    return true;
  }
  const labVerifyMatch = pathname.match(/^\/api\/labs\/([^/]+)\/verify$/);
  if (labVerifyMatch && method === "POST") {
    let updated;
    await store.mutate(data => {
      const lab = data.labs.find(item => item.id === decodeURIComponent(labVerifyMatch[1]));
      if (!lab) return;
      const missing = [];
      if (!lab.name) missing.push("name");
      if (!lab.location) missing.push("location");
      if (!lab.tests?.some(test => numeric(test.price) > 0)) missing.push("priced test");
      if (missing.length) {
        updated = { validationError: missing };
        return;
      }
      lab.status = "verified";
      lab.verified = true;
      lab.verifiedAt = new Date().toISOString();
      updated = lab;
    });
    if (!updated) sendError(response, 404, "PathLab not found");
    else if (updated.validationError) sendError(response, 422, "PathLab profile is incomplete", updated.validationError);
    else sendJson(response, 200, updated);
    return true;
  }

  if ((pathname === "/api/bookings" || pathname === "/api/appointments") && method === "GET") {
    let bookings = database.bookings;
    if (searchParams.get("patientId")) bookings = bookings.filter(item => item.patientId === searchParams.get("patientId"));
    if (searchParams.get("doctorId")) bookings = bookings.filter(item => item.doctorId === searchParams.get("doctorId"));
    sendJson(response, 200, bookings);
    return true;
  }
  if ((pathname === "/api/bookings" || pathname === "/api/appointments") && method === "POST") {
    const input = await readJson(request);
    const booking = normalizeBooking(input, database);
    if (booking.providerType === "doctor") {
      const schedule = database.doctorSchedules?.[booking.doctorId]?.[booking.date];
      const queue = ensureDoctorQueue(database, booking.doctorId, booking.date);
      if (schedule && queue.issued >= schedule.capacity) {
        sendError(response, 409, "The doctor's daily appointment capacity is full");
        return true;
      }
      booking.token = `T${String((queue.issued || 0) + 1).padStart(3, "0")}`;
    }
    await store.mutate(data => {
      data.bookings.unshift(booking);
      if (booking.providerType === "doctor") {
        const queue = ensureDoctorQueue(data, booking.doctorId, booking.date);
        queue.issued += 1;
        queue.capacity ||= data.doctorSchedules?.[booking.doctorId]?.[booking.date]?.capacity || 0;
        queue.waiting.push({ token: booking.token, name: booking.patientName, reason: booking.reason || "Consultation", appointmentId: booking.id, checkedIn: true, wait: queue.waiting.length * queue.expectedMinutes });
      }
      if (booking.providerType === "doctor" && booking.doctorId === data.doctorWorkspace.doctorId) {
        data.doctorWorkspace.appointments.push(doctorAppointmentFromBooking(booking, data.doctorWorkspace));
      }
      data.notifications.unshift(normalizeNotification({
        title: booking.providerType === "lab" ? "Lab booking confirmed" : "Appointment confirmed",
        message: `${booking.providerName} is booked for ${booking.date} at ${booking.time}.`,
        audience: "Single patient",
        icon: "check-circle"
      }));
    });
    sendJson(response, 201, booking);
    return true;
  }
  const bookingMatch = pathname.match(/^\/api\/(?:bookings|appointments)\/([^/]+)$/);
  if (bookingMatch && method === "GET") {
    const booking = database.bookings.find(item => item.id === decodeURIComponent(bookingMatch[1]));
    if (!booking) sendError(response, 404, "Booking not found");
    else sendJson(response, 200, booking);
    return true;
  }
  if (bookingMatch && ["PUT", "PATCH"].includes(method)) {
    const input = await readJson(request);
    let updated;
    await store.mutate(data => {
      const index = data.bookings.findIndex(item => item.id === decodeURIComponent(bookingMatch[1]));
      if (index < 0) return;
      updated = normalizeBooking({ ...data.bookings[index], ...input, id: data.bookings[index].id }, data);
      data.bookings[index] = updated;
      const doctorAppointment = data.doctorWorkspace.appointments.find(item => item.id === updated.id);
      if (doctorAppointment) Object.assign(doctorAppointment, doctorAppointmentFromBooking(updated, data.doctorWorkspace), { id: updated.id });
    });
    if (!updated) sendError(response, 404, "Booking not found");
    else sendJson(response, 200, updated);
    return true;
  }
  if (bookingMatch && method === "DELETE") {
    let removed;
    await store.mutate(data => {
      const index = data.bookings.findIndex(item => item.id === decodeURIComponent(bookingMatch[1]));
      if (index >= 0) removed = data.bookings.splice(index, 1)[0];
      data.doctorWorkspace.appointments = data.doctorWorkspace.appointments.filter(item => item.id !== decodeURIComponent(bookingMatch[1]));
    });
    if (!removed) sendError(response, 404, "Booking not found");
    else sendJson(response, 200, removed);
    return true;
  }

  if (pathname === "/api/users" && method === "GET") {
    sendJson(response, 200, database.users);
    return true;
  }
  if (pathname === "/api/reports" && method === "GET") {
    const patientId = searchParams.get("patientId");
    sendJson(response, 200, patientId ? database.reports.filter(item => item.patientId === patientId) : database.reports);
    return true;
  }
  if (pathname === "/api/notifications" && method === "GET") {
    sendJson(response, 200, database.notifications);
    return true;
  }
  if (pathname === "/api/notifications" && method === "POST") {
    const notification = normalizeNotification(await readJson(request));
    await store.mutate(data => data.notifications.unshift(notification));
    sendJson(response, 201, notification);
    return true;
  }

  const queueMatch = pathname.match(/^\/api\/queues\/([^/]+)$/);
  if (queueMatch && method === "GET") {
    const queue = database.queues[decodeURIComponent(queueMatch[1])];
    if (!queue) sendError(response, 404, "Queue not found");
    else {
      const token = searchParams.get("token");
      const ahead = token ? queue.waiting.findIndex(item => item.token === token) : -1;
      sendJson(response, 200, { ...queue, remaining: Math.max(0, Number(queue.capacity || 0) - Number(queue.issued || 0)), live: token ? { patientStatus: ahead >= 0 ? "waiting" : queue.current?.token === token ? "in-progress" : "unknown", ahead: Math.max(0, ahead) } : undefined });
    }
    return true;
  }
  const queueActionMatch = pathname.match(/^\/api\/queues\/([^/]+)\/action$/);
  if (queueActionMatch && method === "POST") {
    const payload = await readJson(request);
    let queue;
    await store.mutate(data => {
      const doctorId = decodeURIComponent(queueActionMatch[1]);
      queue = data.queues[doctorId];
      if (queue) updateQueue(queue, payload.action, payload, data);
    });
    if (!queue) sendError(response, 404, "Queue not found");
    else sendJson(response, 200, queue);
    return true;
  }

  if (pathname === "/api/doctor/dashboard" && method === "GET") {
    sendJson(response, 200, database.doctorWorkspace.dashboard);
    return true;
  }
  if (pathname === "/api/doctor/schedule" && method === "PUT") {
    const doctorId = requireDoctor();
    const input = await readJson(request);
    const date = String(input.date || new Date().toISOString().slice(0, 10));
    const capacity = Math.max(1, Number(input.maxDailyTokens) || 100);
    const slots = scheduleSlots(input.startTime, input.endTime, input.durationMinutes, capacity);
    if (!slots.length) { sendError(response, 422, "Provide a valid schedule window"); return true; }
    const schedule = { id: `schedule-${date}`, doctorId, date, startTime: input.startTime, endTime: input.endTime, durationMinutes: Number(input.durationMinutes) || 15, capacity: slots.length, maxDailyTokens: capacity, bookedCount: 0, remainingTokens: slots.length, slots };
    await store.mutate(data => {
      data.doctorSchedules ||= {};
      data.doctorSchedules[doctorId] ||= {};
      data.doctorSchedules[doctorId][date] = schedule;
      data.doctorWorkspace.doctorId = doctorId;
      ensureDoctorQueue(data, doctorId, date).capacity = slots.length;
    });
    sendJson(response, 200, schedule);
    return true;
  }
  const doctorSlotsMatch = pathname.match(/^\/api\/doctors\/([^/]+)\/slots$/);
  if (doctorSlotsMatch && method === "GET") {
    const doctorId = decodeURIComponent(doctorSlotsMatch[1]);
    const schedule = database.doctorSchedules?.[doctorId]?.[searchParams.get("date")];
    sendJson(response, 200, schedule || { doctorId, date: searchParams.get("date"), capacity: 0, slots: [] });
    return true;
  }
  if (pathname === "/api/doctor/appointments" && method === "GET") {
    let appointments = database.doctorWorkspace.appointments;
    const requestedDate = searchParams.get("date");
    if (requestedDate && requestedDate !== "today") appointments = appointments.filter(item => !item.date || item.date === requestedDate);
    sendJson(response, 200, appointments);
    return true;
  }
  if (pathname === "/api/doctor/appointments" && method === "POST") {
    const input = await readJson(request);
    const appointment = { ...input, id: input.id || slugId("apt"), status: String(input.status || "pending").toLowerCase() };
    await store.mutate(data => data.doctorWorkspace.appointments.push(appointment));
    sendJson(response, 201, appointment);
    return true;
  }
  const doctorAppointmentMatch = pathname.match(/^\/api\/doctor\/appointments\/([^/]+)$/);
  if (doctorAppointmentMatch && method === "PATCH") {
    const input = await readJson(request);
    let appointment;
    await store.mutate(data => {
      appointment = data.doctorWorkspace.appointments.find(item => item.id === decodeURIComponent(doctorAppointmentMatch[1]));
      if (appointment) Object.assign(appointment, input, { updatedAt: new Date().toISOString() });
    });
    if (!appointment) sendError(response, 404, "Appointment not found");
    else sendJson(response, 200, appointment);
    return true;
  }
  const doctorAppointmentSubMatch = pathname.match(/^\/api\/doctor\/appointments\/([^/]+)\/(reschedule|notes)$/);
  if (doctorAppointmentSubMatch && method === "POST") {
    const input = await readJson(request);
    let appointment;
    await store.mutate(data => {
      appointment = data.doctorWorkspace.appointments.find(item => item.id === decodeURIComponent(doctorAppointmentSubMatch[1]));
      if (!appointment) return;
      if (doctorAppointmentSubMatch[2] === "reschedule") Object.assign(appointment, input, { status: "confirmed" });
      else appointment.note = input.note || "";
      appointment.updatedAt = new Date().toISOString();
    });
    if (!appointment) sendError(response, 404, "Appointment not found");
    else sendJson(response, 200, appointment);
    return true;
  }
  if (pathname === "/api/doctor/queue" && method === "GET") {
    sendJson(response, 200, database.queues[database.doctorWorkspace.doctorId]);
    return true;
  }
  const doctorQueueAction = pathname.match(/^\/api\/doctor\/queue\/(start|resume|pause|next|notify|close|delay|settings)$/);
  if (doctorQueueAction && ["POST", "PATCH"].includes(method)) {
    const payload = await readJson(request);
    let queue;
    await store.mutate(data => {
      queue = data.queues[data.doctorWorkspace.doctorId];
      updateQueue(queue, doctorQueueAction[1], payload, data);
    });
    sendJson(response, 200, queue);
    return true;
  }
  if (pathname === "/api/doctor/patients" && method === "GET") {
    sendJson(response, 200, database.doctorWorkspace.patients);
    return true;
  }
  if (pathname === "/api/doctor/profile" && method === "GET") {
    sendJson(response, 200, database.doctorWorkspace.profile);
    return true;
  }
  if (pathname === "/api/doctor/profile" && method === "PUT") {
    const input = await readJson(request);
    let profile;
    await store.mutate(data => {
      profile = { ...data.doctorWorkspace.profile, ...input, updatedAt: new Date().toISOString() };
      data.doctorWorkspace.profile = profile;
      const index = data.doctors.findIndex(item => item.id === data.doctorWorkspace.doctorId);
      if (index >= 0) {
        const publicUpdates = {
          name: profile.name,
          specialty: profile.specialisation || profile.specialty,
          clinic: profile.clinic,
          address: profile.address,
          location: profile.address,
          languages: profile.languages,
          services: Array.isArray(profile.services) ? profile.services.map(service => service.name || service) : undefined,
          fee: profile.services?.[0]?.fee ?? data.doctors[index].fee
        };
        data.doctors[index] = normalizeDoctor(publicUpdates, data.doctors[index]);
      }
    });
    sendJson(response, 200, profile);
    return true;
  }
  if (pathname === "/api/doctor/analytics" && method === "GET") {
    sendJson(response, 200, { ...database.doctorWorkspace.analytics, range: numeric(searchParams.get("range"), 30) });
    return true;
  }

  if (pathname === "/api/auth/patient/identity/start" && method === "POST") {
    const input = await readJson(request);
    if (hasRawIdentityData(input)) {
      sendError(response, 422, "Do not send raw Aadhaar numbers, VID, face images or biometric data to SehatLine");
      return true;
    }
    const phone = phoneDigits(input.phone);
    if (phone.length !== 10) {
      sendError(response, 422, "Verify a valid mobile number before identity verification");
      return true;
    }
    if (input.consent !== true) {
      sendError(response, 422, "Explicit identity-verification consent is required");
      return true;
    }
    if (!useIdentitySandbox) {
      sendError(response, 503, "UIDAI-authorised identity provider is not configured", [
        "Configure an approved Aadhaar requesting entity or verification provider",
        "Use UIDAI FaceRD for face authentication",
        "Never send raw biometrics through this API"
      ]);
      return true;
    }
    const verificationId = `identity-${randomUUID()}`;
    identitySessions.set(verificationId, {
      id: verificationId,
      phone,
      profile: {
        name: firstText(input.profile?.name),
        dateOfBirth: firstText(input.profile?.dateOfBirth)
      },
      method: "aadhaar-face",
      status: "pending",
      sandbox: true,
      createdAt: new Date().toISOString()
    });
    sendJson(response, 201, {
      verificationId,
      status: "pending",
      method: "aadhaar-face",
      provider: "UIDAI sandbox adapter",
      sandbox: true,
      nextAction: "launch-face-rd"
    });
    return true;
  }

  if (pathname === "/api/auth/patient/identity/complete" && method === "POST") {
    const input = await readJson(request);
    if (hasRawIdentityData(input)) {
      sendError(response, 422, "Do not send raw Aadhaar numbers, VID, face images or biometric data to SehatLine");
      return true;
    }
    const verification = identitySessions.get(String(input.verificationId || ""));
    if (!verification) {
      sendError(response, 404, "Identity verification session was not found or has expired");
      return true;
    }
    if (!useIdentitySandbox || verification.sandbox !== true) {
      sendError(response, 503, "UIDAI-authorised identity provider is not configured");
      return true;
    }
    const verifiedAt = new Date().toISOString();
    let user;
    await store.mutate(data => {
      const existingIndex = data.users.findIndex(item => phoneDigits(item.phone) === verification.phone);
      const existing = existingIndex >= 0 ? data.users[existingIndex] : {};
      user = {
        ...existing,
        id: existing.id || slugId("user"),
        name: verification.profile.name || existing.name || "SehatLine Member",
        phone: existing.phone || `+91 ${verification.phone.slice(0, 5)} ${verification.phone.slice(5)}`,
        dateOfBirth: verification.profile.dateOfBirth || existing.dateOfBirth || "",
        bookings: numeric(existing.bookings),
        lastActive: "Just now",
        status: "active",
        identityVerification: {
          status: "sandbox-verified",
          method: "aadhaar-face",
          provider: "UIDAI sandbox adapter",
          reference: verification.id,
          verifiedAt,
          rawIdentityStored: false
        }
      };
      if (existingIndex >= 0) data.users[existingIndex] = user;
      else data.users.push(user);
    });
    identitySessions.delete(verification.id);
    sendJson(response, 200, {
      verified: true,
      sandbox: true,
      identityStatus: "sandbox-verified",
      token: `demo-${randomUUID()}`,
      user
    });
    return true;
  }

  if ((pathname === "/api/auth/send-otp" || pathname === "/api/auth/doctor/request-otp") && method === "POST") {
    const input = await readJson(request);
    const phone = phoneDigits(input.phone);
    if (phone.length !== 10) {
      sendError(response, 422, "Enter a valid phone number");
      return true;
    }
    const previousSend = otpSendTimes.get(phone) || 0;
    if (Date.now() - previousSend < 30_000) {
      sendError(response, 429, "Please wait 30 seconds before requesting another OTP");
      return true;
    }
    if (msg91SendOtpConfigured) {
      try {
        const providerResult = await sendMsg91Otp(phone);
        otpSendTimes.set(phone, Date.now());
        sendJson(response, 200, {
          sent: true,
          phone: `+91${phone}`,
          provider: "msg91",
          requestId: firstText(providerResult.request_id, providerResult.message),
          expiresInSeconds: 120
        });
      } catch (error) {
        sendError(response, 502, "SMS delivery failed", error.message);
      }
      return true;
    }
    if (useOtpSandbox) {
      otpSendTimes.set(phone, Date.now());
      sendJson(response, 200, {
        sent: true,
        phone: `+91${phone}`,
        provider: "local-sandbox",
        expiresInSeconds: 120
      });
      return true;
    }
    sendError(response, 503, "Live SMS OTP is not configured", [
      "Add MSG91_AUTH_KEY and MSG91_TEMPLATE_ID to .env.local",
      "Use an approved MSG91 OTP template for Indian mobile delivery"
    ]);
    return true;
  }
  if (pathname === "/api/auth/verify-widget-token" && method === "POST") {
    if (!msg91WidgetConfigured) {
      sendError(response, 503, "MSG91 OTP Widget is not configured");
      return true;
    }
    const input = await readJson(request);
    const accessToken = String(input.accessToken || "").trim();
    const requestedPhone = phoneDigits(input.phone);
    if (!accessToken || accessToken.length > 4096) {
      sendError(response, 422, "A valid MSG91 access token is required");
      return true;
    }
    try {
      const providerResult = await verifyMsg91WidgetAccessToken(accessToken, providerFetch);
      const verifiedPhone = phoneDigits(widgetIdentifier(providerResult, accessToken));
      if (requestedPhone.length === 10 && verifiedPhone.length === 10 && requestedPhone !== verifiedPhone) {
        sendError(response, 401, "The verified mobile number does not match this login");
        return true;
      }
      const phone = verifiedPhone.length === 10 ? verifiedPhone : requestedPhone;
      if (phone.length !== 10) {
        sendError(response, 401, "MSG91 did not return a verified mobile identifier");
        return true;
      }
      const existingPatient = database.users.find(item => phoneDigits(item.phone) === phone);
      sendJson(response, 200, {
        verified: true,
        provider: "msg91-widget",
        token: `session-${randomUUID()}`,
        user: existingPatient || {
          id: slugId("user"),
          name: "SehatLine Member",
          phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`
        }
      });
    } catch (error) {
      sendError(response, 401, "The OTP session is invalid or expired", error.message);
    }
    return true;
  }
  if ((pathname === "/api/auth/verify-otp" || pathname === "/api/auth/doctor/verify-otp") && method === "POST") {
    const input = await readJson(request);
    const phone = phoneDigits(input.phone);
    const otp = String(input.otp || "").trim();
    if (phone.length !== 10 || !/^\d{4,9}$/.test(otp)) {
      sendError(response, 422, "Enter a valid phone number and OTP");
      return true;
    }
    try {
      if (msg91SendOtpConfigured) {
        await verifyMsg91Otp(phone, otp);
      } else if (useOtpSandbox) {
        if (otp !== "123456") {
          sendError(response, 401, "The OTP is invalid or expired");
          return true;
        }
      } else {
        sendError(response, 503, "Live SMS OTP is not configured");
        return true;
      }
    } catch (error) {
      sendError(response, 401, "The OTP is invalid or expired", error.message);
      return true;
    }
    const isDoctorLogin = pathname.includes("/doctor/");
    const matchedDoctor = isDoctorLogin ? database.doctors.find(item => phoneDigits(item.phone) === phone && verified(item)) : null;
    if (isDoctorLogin && !matchedDoctor) {
      sendError(response, 403, "This mobile number is not registered to an approved doctor");
      return true;
    }
    const existingPatient = database.users.find(item => phoneDigits(item.phone) === phone);
    const sessionToken = `${isDoctorLogin ? "doctor" : "patient"}-${randomUUID()}`;
    if (isDoctorLogin) doctorSessions.set(sessionToken, matchedDoctor.id);
    sendJson(response, 200, {
      verified: true,
      provider: msg91SendOtpConfigured ? "msg91" : "local-sandbox",
      token: sessionToken,
      user: isDoctorLogin
        ? publicDoctor(matchedDoctor)
        : existingPatient || { id: slugId("user"), name: "SehatLine Member", phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` },
      doctor: isDoctorLogin ? publicDoctor(matchedDoctor) : undefined
    });
    return true;
  }

  const receptionistAuth = async () => {
    const auth = await adminAuth.authenticate(request);
    if (![
      "receptionist",
      "super_admin"
    ].includes(auth.admin.role)) throw Object.assign(new Error("Receptionist access required"), { statusCode: 403, code: "ACCESS_DENIED" });
    return auth;
  };
  const receptionistAccess = async () => {
    const auth = await receptionistAuth();
    if (auth.admin.mustChangePassword) throw Object.assign(new Error("Password change required"), { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    const doctorId = String(searchParams.get("doctorId") || (await readJson(request).catch(() => ({}))).doctorId || "");
    if (auth.admin.role !== "super_admin" && (!doctorId || !auth.admin.assignedDoctorIds.includes(doctorId))) {
      throw Object.assign(new Error("This doctor is not assigned to your account"), { statusCode: 403, code: "DOCTOR_ACCESS_DENIED" });
    }
    return { auth, doctorId };
  };
  if (pathname === "/api/receptionist/auth/change-password" && method === "POST") {
    const auth = await receptionistAuth();
    adminAuth.verifyCsrf(request, auth);
    await adminAuth.changePassword(auth, await readJson(request));
    sendJson(response, 200, { changed: true }, { "Set-Cookie": adminAuth.clearCookie() });
    return true;
  }
  if (pathname === "/api/receptionist/auth/me" && method === "GET") {
    const auth = await receptionistAuth();
    const doctors = database.doctors.filter(doctor => auth.admin.role === "super_admin" || auth.admin.assignedDoctorIds.includes(doctor.id)).map(publicDoctor);
    sendJson(response, 200, { admin: auth.admin, doctors });
    return true;
  }
  if (pathname.startsWith("/api/receptionist/")) {
    const auth = await receptionistAuth();
    if (auth.admin.mustChangePassword) throw Object.assign(new Error("Password change required"), { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    const input = ["POST", "PATCH", "PUT"].includes(method) ? await readJson(request) : {};
    const doctorId = String(searchParams.get("doctorId") || input.doctorId || "");
    if (auth.admin.role !== "super_admin" && (!doctorId || !auth.admin.assignedDoctorIds.includes(doctorId))) {
      throw Object.assign(new Error("This doctor is not assigned to your account"), { statusCode: 403, code: "DOCTOR_ACCESS_DENIED" });
    }
    const doctor = database.doctors.find(item => item.id === doctorId);
    if (!doctor) { sendError(response, 404, "Assigned doctor not found"); return true; }
    const date = String(searchParams.get("date") || input.date || new Date().toISOString().slice(0, 10));
    const schedule = database.doctorSchedules?.[doctorId]?.[date]
      || database.doctorWorkspaces?.[doctorId]?.schedules?.find(item => item.date === date)
      || (database.doctorWorkspace?.doctorId === doctorId ? database.doctorWorkspace.schedules?.find(item => item.date === date) : null);
    const queue = ensureDoctorQueue(database, doctorId, date);
    if (schedule) queue.capacity ||= Number(schedule.capacity || schedule.maxDailyTokens || schedule.slots?.length || 0);
    if (pathname === "/api/receptionist/dashboard" && method === "GET") {
      const appointments = database.bookings.filter(item => item.doctorId === doctorId && item.date === date).map(item => doctorAppointmentFromBooking(item, { appointments: [] }));
      const patients = database.users.filter(item => appointments.some(appointment => phoneDigits(appointment.phone) === phoneDigits(item.phone)));
      sendJson(response, 200, { doctor: publicDoctor(doctor), doctors: [publicDoctor(doctor)], appointments, queue, patients, metrics: { totalAppointments: appointments.length, checkedIn: appointments.filter(item => ["checked-in", "in-progress"].includes(item.status)).length, waiting: queue.waiting.length, completed: appointments.filter(item => item.status === "completed").length, remainingTokens: Math.max(0, Number(queue.capacity || 0) - Number(queue.issued || 0)) } });
      return true;
    }
    if (pathname === "/api/receptionist/patients" && method === "GET") {
      const query = String(searchParams.get("q") || "").toLowerCase();
      const patients = (database.users || []).filter(item => !query || `${item.name} ${item.phone}`.toLowerCase().includes(query));
      sendJson(response, 200, patients);
      return true;
    }
    const receptionistAppointment = pathname.match(/^\/api\/receptionist\/appointments\/([^/]+)$/);
    if (receptionistAppointment && method === "PATCH") {
      let updated;
      await store.mutate(data => {
        const booking = data.bookings.find(item => item.id === decodeURIComponent(receptionistAppointment[1]) && item.doctorId === doctorId);
        if (!booking) return;
        booking.status = input.status || booking.status;
        updated = booking;
        const queueEntry = ensureDoctorQueue(data, doctorId, booking.date).waiting.find(item => item.appointmentId === booking.id);
        if (queueEntry) queueEntry.checkedIn = booking.status === "checked-in";
      });
      if (!updated) sendError(response, 404, "Appointment not found"); else sendJson(response, 200, updated);
      return true;
    }
    const queueAction = pathname.match(/^\/api\/receptionist\/queue\/(start|resume|pause|next|notify|close|delay)$/);
    if (queueAction && method === "POST") {
      let updated;
      await store.mutate(data => { updated = updateQueue(ensureDoctorQueue(data, doctorId, date), queueAction[1], input, data); });
      sendJson(response, 200, updated);
      return true;
    }
    if (pathname === "/api/receptionist/walk-ins" && method === "POST") {
      if (!schedule) { sendError(response, 409, "The doctor has not published a schedule for this date"); return true; }
      const nextSlot = schedule.slots.find(slot => slot.available);
      if (!nextSlot || queue.issued >= schedule.capacity) { sendError(response, 409, "The doctor's daily capacity is full"); return true; }
      const booking = normalizeBooking({ ...input, doctorId, date, time: nextSlot.time, providerType: "doctor", status: "checked-in" }, database);
      booking.token = `T${String(queue.issued + 1).padStart(3, "0")}`;
      await store.mutate(data => { data.bookings.unshift(booking); const currentQueue = ensureDoctorQueue(data, doctorId, date); currentQueue.issued += 1; currentQueue.capacity = schedule.capacity; currentQueue.waiting.push({ token: booking.token, name: booking.patientName, reason: booking.reason || "Consultation", appointmentId: booking.id, checkedIn: true, wait: currentQueue.waiting.length * currentQueue.expectedMinutes }); });
      sendJson(response, 201, { ...booking, status: "checked-in", token: booking.token });
      return true;
    }
    sendError(response, 404, "Receptionist route not found");
    return true;
  }

  if ((pathname === "/api/ai/query" || pathname === "/api/ai/recommend") && method === "POST") {
    const input = await readJson(request);
    const recommendation = await aiRecommend({
      query: String(input.query || ""),
      location: input.location,
      doctors: database.doctors.filter(verified).map(publicDoctor),
      labs: database.labs.filter(verified)
    });
    const results = Array.isArray(recommendation.results) ? recommendation.results : [];
    const resultIds = recommendation.resultIds || results.map(item => typeof item === "string" ? item : item.id).filter(Boolean);
    const answer = recommendation.answer || recommendation.message || recommendation.explanation || "I found healthcare options for you.";
    if (pathname === "/api/ai/query") sendJson(response, 200, { ...recommendation, answer, message: answer, resultIds });
    else sendJson(response, 200, { ...recommendation, answer, resultIds });
    return true;
  }

  if (pathname.startsWith("/api/")) {
    sendError(response, 404, "API route not found");
    return true;
  }
  return false;
}

async function serveStatic(request, response, url, uploadRoot) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendError(response, 400, "Invalid URL encoding");
    return;
  }

  const portalRoots = [
    ["/patient", "patient_app"],
    ["/doctor", "doctor_app"],
    ["/receptionist", "receptionist_app"],
    ["/admin", "admin_panel"]
  ];
  for (const [route, directory] of portalRoots) {
    if (pathname === route) {
      response.writeHead(308, { Location: `${route}/`, "Cache-Control": "no-store" });
      response.end();
      return;
    }
    if (pathname.startsWith(`${route}/`)) {
      const requestedRelative = pathname.slice(route.length + 1);
      const adminAliases = {
        login: "login.html",
        dashboard: "index.html",
        "change-password": "change-password.html"
      };
      const relative = route === "/admin"
        ? adminAliases[requestedRelative] || requestedRelative || "index.html"
        : requestedRelative || "index.html";
      return sendFile(response, path.resolve(projectRoot, directory), relative);
    }
  }
  if (pathname === "/sitemap.xml") {
  return sendFile(response, projectRoot, "sitemap.xml");
}

if (pathname === "/robots.txt") {
  return sendFile(response, projectRoot, "robots.txt");
}
  if (pathname === "/about" || pathname === "/about/") {
  return sendFile(response, projectRoot, "about.html");
}

if (pathname === "/contact" || pathname === "/contact/") {
  return sendFile(response, projectRoot, "contact.html");
}
  if (pathname.startsWith("/assets/")) {
    return sendFile(response, path.resolve(projectRoot, "assets"), pathname.slice("/assets/".length));
  }
  if (pathname.startsWith("/uploads/") && uploadRoot) {
    return sendFile(response, path.resolve(uploadRoot), pathname.slice("/uploads/".length));
  }
  if (pathname === "/" || pathname === "/index.html") {
    return sendFile(response, projectRoot, "index.html");
  }
  sendError(response, 404, "Page not found");
}

async function sendFile(response, rootDirectory, relativePath) {
  const requested = path.resolve(rootDirectory, relativePath);
  const normalizedRoot = `${path.resolve(rootDirectory)}${path.sep}`;
  if (requested !== path.resolve(rootDirectory) && !requested.startsWith(normalizedRoot)) {
    sendError(response, 403, "Forbidden path");
    return;
  }
  let filePath = requested;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    const body = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extension) || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": [".html", ".css", ".js"].includes(extension) ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin"
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT") sendError(response, 404, "Asset not found");
    else throw error;
  }
}

export async function createSehatLineServer(options = {}) {
  const useMongo = !options.store
    && options.useMongo !== false
    && Boolean(String(process.env.MONGODB_URI || "").trim())
    && process.env.SEHATLINE_SKIP_DATABASE !== "true";
  if (useMongo) await connectDatabase();
  const store = options.store || (useMongo ? new MongoStore() : new JsonStore(options.dataFile));
  if (!store.data) await store.initialize();
  const adminAuth = new AdminAuthService({
    store,
    jwtSecret: options.adminJwtSecret || process.env.ADMIN_JWT_SECRET || randomBytes(48).toString("hex"),
    production: options.production ?? process.env.NODE_ENV === "production"
  });
  await adminAuth.initialize();
  const doctorSessions = new Map();
  const logger = options.logger || console;
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const handled = await routeApi(request, response, url, store, {
        adminAuth,
        doctorSessions,
        uploadRoot: options.uploadRoot,
        providerFetch: options.providerFetch,
        identitySandboxEnabled: options.identitySandboxEnabled,
        otpSandboxEnabled: options.otpSandboxEnabled
      });
      if (!handled && url.pathname === "/admin/dashboard") {
        try {
          const auth = await adminAuth.authenticate(request);
          if (auth.admin.mustChangePassword) {
            response.writeHead(302, { Location: "/admin/change-password" });
            response.end();
          } else {
            await serveStatic(request, response, url, options.uploadRoot || process.env.SEHATLINE_UPLOAD_ROOT);
          }
        } catch {
          response.writeHead(302, { Location: "/admin/login" });
          response.end();
        }
      } else if (!handled) await serveStatic(request, response, url, options.uploadRoot || process.env.SEHATLINE_UPLOAD_ROOT);
    } catch (error) {
      logger.error?.("[SehatLine API]", error);
      const adminError = adminErrorPayload(error);
      if (!response.headersSent && adminError) sendJson(response, adminError.statusCode, adminError.payload);
      else if (!response.headersSent && error.code) sendJson(response, error.statusCode || 500, { error: { code: error.code, message: error.message } });
      else if (!response.headersSent) sendError(response, error.statusCode || 500, error.statusCode ? error.message : "Unexpected server error");
      else response.end();
    }
  });
  return { server, store, adminAuth };
}

export async function startServer(options = {}) {
  const { server, store, adminAuth } = await createSehatLineServer(options);
  const requestedPort = options.port ?? DEFAULT_PORT;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
   server.listen(
  requestedPort,
  options.host || process.env.HOST || "0.0.0.0",
  resolve
);
  });
  const address = server.address();
  const port = typeof address === "object" ? address.port : requestedPort;
  return { server, store, adminAuth, port, url: `http://127.0.0.1:${port}` };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  startServer()
    .then(({ url }) => {
      console.log(`\n  SehatLine is running at ${url}`);
      console.log(`  Patient: ${url}/patient/`);
      console.log(`  Doctor:  ${url}/doctor/`);
      console.log(`  Admin:   ${url}/admin/\n`);
    })
    .catch(error => {
      console.error("Failed to start SehatLine:", error);
      process.exitCode = 1;
    });
}
