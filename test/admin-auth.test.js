import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSehatLineServer } from "../backend/src/server.js";

const JWT_SECRET = "test-only-admin-jwt-secret-with-more-than-thirty-two-characters";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function sessionCookie(response) {
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

async function json(response) {
  const body = await response.json().catch(() => null);
  return { response, body };
}

test("admin authentication, RBAC, password reset and session invalidation are enforced", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-admin-auth-"));
  const dataFile = path.join(directory, "runtime.json");
  const { server, adminAuth, store } = await createSehatLineServer({
    dataFile,
    adminJwtSecret: JWT_SECRET,
    production: false,
    logger: { error() {}, warn() {} }
  });
  const baseUrl = await listen(server);

  try {
    const seeded = await adminAuth.createFirstSuperAdmin({
      fullName: "Security Owner",
      email: "owner@sehatline.test",
      mobile: "+91 98765 43210",
      password: "Temporary!Pass9"
    });
    assert.equal(seeded.admin.adminId, "SL-ADMIN-001");
    assert.equal("passwordHash" in seeded.admin, false);
    assert.notEqual(store.snapshot().admins[0].passwordHash, "Temporary!Pass9");

    const unauthenticated = await fetch(`${baseUrl}/api/admin/overview`);
    assert.equal(unauthenticated.status, 401);
    assert.equal((await unauthenticated.json()).error.code, "AUTH_REQUIRED");
    const directRoute = await fetch(`${baseUrl}/admin/dashboard`, { redirect: "manual" });
    assert.equal(directRoute.status, 302);
    assert.equal(directRoute.headers.get("location"), "/admin/login");

    const wrongLogin = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "SL-ADMIN-001", password: "Wrong!Pass9" })
    });
    assert.equal(wrongLogin.status, 401);
    assert.equal((await wrongLogin.json()).error.code, "INVALID_CREDENTIALS");

    const loginResult = await json(await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "owner@sehatline.test", password: "Temporary!Pass9" })
    }));
    assert.equal(loginResult.response.status, 200);
    assert.equal(loginResult.body.mustChangePassword, true);
    assert.equal("token" in loginResult.body, false);
    const ownerCookie = sessionCookie(loginResult.response);
    const ownerCsrf = loginResult.body.csrfToken;
    assert.match(loginResult.response.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(loginResult.response.headers.get("set-cookie"), /SameSite=Strict/i);

    const blockedBeforeChange = await fetch(`${baseUrl}/api/admin/overview`, { headers: { Cookie: ownerCookie } });
    assert.equal(blockedBeforeChange.status, 403);
    assert.equal((await blockedBeforeChange.json()).error.code, "PASSWORD_CHANGE_REQUIRED");

    const changed = await fetch(`${baseUrl}/api/admin/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie, "X-Admin-CSRF": ownerCsrf },
      body: JSON.stringify({ currentPassword: "Temporary!Pass9", newPassword: "Permanent!Owner8" })
    });
    assert.equal(changed.status, 200);
    assert.equal((await fetch(`${baseUrl}/api/admin/auth/me`, { headers: { Cookie: ownerCookie } })).status, 401);

    const permanentLogin = await json(await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "SL-ADMIN-001", password: "Permanent!Owner8" })
    }));
    const permanentCookie = sessionCookie(permanentLogin.response);
    const permanentCsrf = permanentLogin.body.csrfToken;
    assert.equal(permanentLogin.body.mustChangePassword, false);
    assert.equal((await fetch(`${baseUrl}/api/admin/overview`, { headers: { Cookie: permanentCookie } })).status, 200);

    const createdResponse = await json(await fetch(`${baseUrl}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: permanentCookie, "X-Admin-CSRF": permanentCsrf },
      body: JSON.stringify({
        fullName: "Analytics Reader",
        email: "analytics@sehatline.test",
        mobile: "+91 91234 56789",
        role: "analytics_admin",
        permissions: ["dashboard", "analytics", "reports"]
      })
    }));
    assert.equal(createdResponse.response.status, 201);
    assert.equal(createdResponse.body.admin.adminId, "SL-ADMIN-002");
    assert.match(createdResponse.body.temporaryPassword, /[A-Z]/);
    assert.equal("passwordHash" in createdResponse.body.admin, false);

    const duplicate = await fetch(`${baseUrl}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: permanentCookie, "X-Admin-CSRF": permanentCsrf },
      body: JSON.stringify({
        fullName: "Duplicate Reader",
        email: "analytics@sehatline.test",
        mobile: "+91 90000 00000",
        role: "analytics_admin"
      })
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, "DUPLICATE_EMAIL");

    const childLogin = await json(await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "SL-ADMIN-002", password: createdResponse.body.temporaryPassword })
    }));
    const childCookie = sessionCookie(childLogin.response);
    const childCsrf = childLogin.body.csrfToken;
    await fetch(`${baseUrl}/api/admin/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: childCookie, "X-Admin-CSRF": childCsrf },
      body: JSON.stringify({ currentPassword: createdResponse.body.temporaryPassword, newPassword: "Analytics!Reader7" })
    });
    const childPermanent = await json(await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "SL-ADMIN-002", password: "Analytics!Reader7" })
    }));
    const childPermanentCookie = sessionCookie(childPermanent.response);
    assert.equal((await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: childPermanentCookie } })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/admin/doctors`, { headers: { Cookie: childPermanentCookie } })).status, 403);

    const bypass = await fetch(`${baseUrl}/api/doctors/nonexistent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert.equal(bypass.status, 401);

    const disabled = await fetch(`${baseUrl}/api/admin/users/${createdResponse.body.admin.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: permanentCookie, "X-Admin-CSRF": permanentCsrf },
      body: JSON.stringify({ status: "disabled" })
    });
    assert.equal(disabled.status, 200);
    assert.equal((await fetch(`${baseUrl}/api/admin/auth/me`, { headers: { Cookie: childPermanentCookie } })).status, 401);
    const disabledLogin = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "SL-ADMIN-002", password: "Analytics!Reader7" })
    });
    assert.equal(disabledLogin.status, 403);
    assert.equal((await disabledLogin.json()).error.code, "ACCOUNT_DISABLED");

    const reset = await json(await fetch(`${baseUrl}/api/admin/users/${createdResponse.body.admin.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: permanentCookie, "X-Admin-CSRF": permanentCsrf },
      body: "{}"
    }));
    assert.equal(reset.response.status, 200);
    assert.equal(reset.body.admin.mustChangePassword, true);
    assert.equal("passwordHash" in reset.body.admin, false);

    const logs = await json(await fetch(`${baseUrl}/api/admin/audit-logs`, { headers: { Cookie: permanentCookie } }));
    assert.equal(logs.response.status, 200);
    assert.ok(logs.body.some(entry => entry.action === "admin.account.disabled"));
    assert.ok(logs.body.some(entry => entry.action === "admin.password.reset"));
    assert.equal(JSON.stringify(logs.body).includes("Permanent!Owner8"), false);
    assert.equal(JSON.stringify(logs.body).includes(permanentCsrf), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("five failed login attempts trigger a temporary generic cooldown", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-admin-lock-"));
  const { server, adminAuth } = await createSehatLineServer({
    dataFile: path.join(directory, "runtime.json"),
    adminJwtSecret: JWT_SECRET,
    production: false,
    logger: { error() {}, warn() {} }
  });
  const baseUrl = await listen(server);
  try {
    await adminAuth.createFirstSuperAdmin({
      fullName: "Lock Test Owner",
      email: "lock@sehatline.test",
      mobile: "+91 90000 11111",
      password: "Temporary!Lock8"
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Security test" },
        body: JSON.stringify({ identifier: "unknown@sehatline.test", password: "Wrong!Pass9" })
      });
      assert.equal(response.status, 401);
    }
    const locked = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Security test" },
      body: JSON.stringify({ identifier: "unknown@sehatline.test", password: "Wrong!Pass9" })
    });
    assert.equal(locked.status, 429);
    assert.equal((await locked.json()).error.code, "TOO_MANY_ATTEMPTS");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
