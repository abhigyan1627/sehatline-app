import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSehatLineServer } from "../backend/src/server.js";

const JWT_SECRET = "test-only-receptionist-secret-with-more-than-thirty-two-characters";
const jsonHeaders = (cookie = "", csrf = "") => ({
  "Content-Type": "application/json",
  ...(cookie ? { Cookie: cookie } : {}),
  ...(csrf ? { "X-Admin-CSRF": csrf } : {})
});
const cookieFrom = response => String(response.headers.get("set-cookie") || "").split(";")[0];
const bodyFrom = response => response.json().catch(() => null);

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function login(baseUrl, identifier, password) {
  const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ identifier, password })
  });
  return { response, body: await bodyFrom(response), cookie: cookieFrom(response) };
}

test("owner-assigned receptionist securely operates only the assigned doctor's live clinic", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-receptionist-"));
  const { server, store, adminAuth } = await createSehatLineServer({
    dataFile: path.join(directory, "runtime.json"),
    adminJwtSecret: JWT_SECRET,
    production: false,
    logger: { error() {}, warn() {} }
  });
  const baseUrl = await listen(server);
  const date = "2026-08-08";

  try {
    await adminAuth.createFirstSuperAdmin({
      fullName: "Clinic Owner",
      email: "owner@sehatline.test",
      mobile: "+91 98765 43210",
      password: "Temporary!Owner8"
    });
    await store.mutate(data => {
      data.doctors.push({
        id: "doctor-assigned",
        name: "Dr. Assigned",
        specialty: "General Physician",
        clinic: "Assigned Care Clinic",
        phone: "+91 90000 00001",
        email: "assigned@example.test",
        status: "verified",
        verified: true
      }, {
        id: "doctor-private",
        name: "Dr. Private",
        specialty: "Dermatologist",
        clinic: "Private Clinic",
        phone: "+91 90000 00002",
        email: "private@example.test",
        status: "verified",
        verified: true
      });
      data.doctorWorkspaces ||= {};
      data.doctorWorkspaces["doctor-assigned"] = {
        doctorId: "doctor-assigned",
        appointments: [],
        patients: [],
        schedules: [{
          id: `schedule-${date}`,
          date,
          startTime: "09:00",
          endTime: "09:30",
          durationMinutes: 15,
          maxDailyTokens: 2,
          capacity: 2,
          bookedCount: 0,
          remainingTokens: 2,
          slots: [{ time: "09:00", available: true }, { time: "09:15", available: true }]
        }],
        profile: {},
        analytics: {}
      };
    });

    const ownerTemporary = await login(baseUrl, "owner@sehatline.test", "Temporary!Owner8");
    const changed = await fetch(`${baseUrl}/api/admin/auth/change-password`, {
      method: "POST",
      headers: jsonHeaders(ownerTemporary.cookie, ownerTemporary.body.csrfToken),
      body: JSON.stringify({ currentPassword: "Temporary!Owner8", newPassword: "Permanent!Owner8" })
    });
    assert.equal(changed.status, 200);
    const owner = await login(baseUrl, "owner@sehatline.test", "Permanent!Owner8");

    const unassignedResponse = await fetch(`${baseUrl}/api/admin/users`, {
      method: "POST",
      headers: jsonHeaders(owner.cookie, owner.body.csrfToken),
      body: JSON.stringify({ fullName: "Unassigned Receptionist", email: "unassigned@sehatline.test", mobile: "+91 90000 11111", role: "receptionist" })
    });
    assert.equal(unassignedResponse.status, 422);
    assert.equal((await bodyFrom(unassignedResponse)).error.code, "DOCTOR_ASSIGNMENT_REQUIRED");

    const createdResponse = await fetch(`${baseUrl}/api/admin/users`, {
      method: "POST",
      headers: jsonHeaders(owner.cookie, owner.body.csrfToken),
      body: JSON.stringify({
        fullName: "Clinic Receptionist",
        email: "desk@sehatline.test",
        mobile: "+91 91234 56789",
        role: "receptionist",
        permissions: ["admin_management", "audit_logs"],
        assignedDoctorIds: ["doctor-assigned"]
      })
    });
    const created = await bodyFrom(createdResponse);
    assert.equal(createdResponse.status, 201);
    assert.equal(created.admin.role, "receptionist");
    assert.deepEqual(created.admin.assignedDoctorIds, ["doctor-assigned"]);
    assert.deepEqual(created.admin.permissions.sort(), ["dashboard", "live_queue", "patient_management"].sort());

    const temporaryReceptionist = await login(baseUrl, created.admin.adminId, created.temporaryPassword);
    const blockedDashboard = await fetch(`${baseUrl}/api/receptionist/dashboard?doctorId=doctor-assigned&date=${date}`, { headers: { Cookie: temporaryReceptionist.cookie } });
    assert.equal(blockedDashboard.status, 403);
    assert.equal((await bodyFrom(blockedDashboard)).error.code, "PASSWORD_CHANGE_REQUIRED");
    const receptionistChanged = await fetch(`${baseUrl}/api/receptionist/auth/change-password`, {
      method: "POST",
      headers: jsonHeaders(temporaryReceptionist.cookie, temporaryReceptionist.body.csrfToken),
      body: JSON.stringify({ currentPassword: created.temporaryPassword, newPassword: "Permanent!Desk8" })
    });
    assert.equal(receptionistChanged.status, 200);

    const receptionist = await login(baseUrl, created.admin.adminId, "Permanent!Desk8");
    const sessionResponse = await fetch(`${baseUrl}/api/receptionist/auth/me`, { headers: { Cookie: receptionist.cookie } });
    const session = await bodyFrom(sessionResponse);
    assert.equal(sessionResponse.status, 200);
    assert.deepEqual(session.doctors.map(doctor => doctor.id), ["doctor-assigned"]);
    assert.equal("registrationNumber" in session.doctors[0], false);

    const deniedDoctor = await fetch(`${baseUrl}/api/receptionist/dashboard?doctorId=doctor-private&date=${date}`, { headers: { Cookie: receptionist.cookie } });
    assert.equal(deniedDoctor.status, 403);
    assert.equal((await bodyFrom(deniedDoctor)).error.code, "DOCTOR_ACCESS_DENIED");

    const walkinResponse = await fetch(`${baseUrl}/api/receptionist/walk-ins`, {
      method: "POST",
      headers: jsonHeaders(receptionist.cookie, receptionist.body.csrfToken),
      body: JSON.stringify({ doctorId: "doctor-assigned", date, patientName: "Real Walkin Patient", patientPhone: "9123456780", patientAge: 38, reason: "Fever" })
    });
    const walkin = await bodyFrom(walkinResponse);
    assert.equal(walkinResponse.status, 201);
    assert.equal(walkin.token, "T001");
    assert.equal(String(walkin.status).toLowerCase(), "checked-in");

    const startQueue = await fetch(`${baseUrl}/api/receptionist/queue/start`, {
      method: "POST",
      headers: jsonHeaders(receptionist.cookie, receptionist.body.csrfToken),
      body: JSON.stringify({ doctorId: "doctor-assigned", date })
    });
    assert.equal(startQueue.status, 200);
    const nextQueueResponse = await fetch(`${baseUrl}/api/receptionist/queue/next`, {
      method: "POST",
      headers: jsonHeaders(receptionist.cookie, receptionist.body.csrfToken),
      body: JSON.stringify({ doctorId: "doctor-assigned", date })
    });
    const nextQueue = await bodyFrom(nextQueueResponse);
    assert.equal(nextQueueResponse.status, 200);
    assert.equal(nextQueue.current.token, "T001");

    const dashboardResponse = await fetch(`${baseUrl}/api/receptionist/dashboard?doctorId=doctor-assigned&date=${date}`, { headers: { Cookie: receptionist.cookie } });
    const dashboard = await bodyFrom(dashboardResponse);
    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboard.metrics.totalAppointments, 1);
    assert.equal(dashboard.queue.currentToken, "T001");
    assert.equal((await fetch(`${baseUrl}/receptionist/`)).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
