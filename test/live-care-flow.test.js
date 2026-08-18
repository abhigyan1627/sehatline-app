import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startServer } from "../backend/src/server.js";

const jsonRequest = (url, method, body, token = "") => fetch(url, {
  method,
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  body: body == null ? undefined : JSON.stringify(body)
});

test("approved doctor login publishes a capped daily queue and issues real sequential tokens", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "sehatline-live-care-"));
  const dataFile = path.join(tempDirectory, "runtime.json");
  const uploadRoot = path.join(tempDirectory, "uploads");
  const providerFetch = async () => new Response(JSON.stringify({
    display_name: "Civil Lines, Prayagraj, Uttar Pradesh",
    address: { suburb: "Civil Lines", city: "Prayagraj", state: "Uttar Pradesh", postcode: "211001" }
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  const { server, store, url } = await startServer({
    port: 0,
    dataFile,
    uploadRoot,
    providerFetch,
    otpSandboxEnabled: true,
    requirePatientAuth: true,
    logger: { error() {}, warn() {} }
  });

  try {
    await store.mutate(data => data.doctors.push({
      id: "doctor-real-1",
      name: "Dr. Real Doctor",
      phone: "+91 98765 43210",
      email: "doctor@example.test",
      specialty: "General Physician",
      clinic: "Real Care Clinic",
      address: "Civil Lines, Prayagraj",
      city: "Prayagraj",
      pincode: "211001",
      registrationNumber: "UPMC-REAL-001",
      registrationCouncil: "UP Medical Council",
      qualification: "MBBS",
      experience: 8,
      fee: 500,
      languages: ["Hindi", "English"],
      status: "verified",
      verified: true,
      verifiedAt: new Date().toISOString()
    }));

    const photo = `data:image/png;base64,${Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString("base64")}`;
    const photoResponse = await jsonRequest(`${url}/api/uploads/profile-photo`, "POST", { role: "patient", dataUrl: photo });
    const uploaded = await photoResponse.json();
    assert.equal(photoResponse.status, 201);
    assert.match(uploaded.url, /^\/uploads\/patient-/);
    assert.ok((await readFile(path.join(uploadRoot, path.basename(uploaded.url)))).length > 8);

    const locationResponse = await jsonRequest(`${url}/api/location/reverse`, "POST", { latitude: 25.45, longitude: 81.84, accuracy: 12 });
    const location = await locationResponse.json();
    assert.equal(locationResponse.status, 200);
    assert.equal(location.city, "Prayagraj");

    const denied = await jsonRequest(`${url}/api/doctor/schedule`, "PUT", { date: "2026-08-06", startTime: "09:00", endTime: "10:00", durationMinutes: 15 });
    assert.equal(denied.status, 401);

    const otpRequest = await jsonRequest(`${url}/api/auth/doctor/request-otp`, "POST", { phone: "9876543210" });
    assert.equal(otpRequest.status, 200);
    const loginResponse = await jsonRequest(`${url}/api/auth/doctor/verify-otp`, "POST", { phone: "9876543210", otp: "123456" });
    const login = await loginResponse.json();
    assert.equal(loginResponse.status, 200);
    assert.match(login.token, /^doctor-/);

    const scheduleResponse = await jsonRequest(`${url}/api/doctor/schedule`, "PUT", {
      date: "2026-08-06",
      startTime: "09:00",
      endTime: "10:00",
      durationMinutes: 15,
      maxDailyTokens: 3
    }, login.token);
    const schedule = await scheduleResponse.json();
    assert.equal(scheduleResponse.status, 200);
    assert.equal(schedule.capacity, 3);
    assert.equal(schedule.bookedCount, 0);
    assert.deepEqual(schedule.slots.map(slot => slot.time), ["09:00", "09:15", "09:30"]);

    const publicSlots = await fetch(`${url}/api/doctors/doctor-real-1/slots?date=2026-08-06`).then(response => response.json());
    assert.equal(publicSlots.capacity, 3);
    assert.equal(publicSlots.slots.length, 3);

    const patientOtpRequest = await jsonRequest(`${url}/api/auth/send-otp`, "POST", { phone: "9123456789" });
    assert.equal(patientOtpRequest.status, 200);
    const patientLoginResponse = await jsonRequest(`${url}/api/auth/verify-otp`, "POST", { phone: "9123456789", otp: "123456" });
    const patientLogin = await patientLoginResponse.json();
    assert.equal(patientLoginResponse.status, 200);
    assert.match(patientLogin.token, /^patient-/);

    const tokens = [];
    for (const [index, time] of ["09:00", "09:15", "09:30"].entries()) {
      const response = await jsonRequest(`${url}/api/appointments`, "POST", {
        doctorId: "doctor-real-1",
        date: "2026-08-06",
        time,
        patientId: `patient-${index + 1}`,
        patientName: `Patient ${index + 1}`,
        reason: "Consultation"
      }, patientLogin.token);
      const booking = await response.json();
      assert.equal(response.status, 201);
      assert.equal(booking.patientId, "9123456789");
      tokens.push(booking.token);
    }
    assert.deepEqual(tokens, ["T001", "T002", "T003"]);

    const fullResponse = await jsonRequest(`${url}/api/appointments`, "POST", {
      doctorId: "doctor-real-1",
      date: "2026-08-06",
      time: "09:45",
      patientName: "Patient 4"
    }, patientLogin.token);
    assert.equal(fullResponse.status, 409);

    const unauthenticatedQueue = await fetch(`${url}/api/queues/doctor-real-1?date=2026-08-06&token=T003`);
    assert.equal(unauthenticatedQueue.status, 401);

    const queueResponse = await fetch(`${url}/api/queues/doctor-real-1?date=2026-08-06&token=T003`, { headers: { Authorization: `Bearer ${patientLogin.token}` } });
    const queue = await queueResponse.json();
    assert.equal(queueResponse.status, 200);
    assert.equal(queue.capacity, 3);
    assert.equal(queue.issued, 3);
    assert.equal(queue.remaining, 0);
    assert.equal("waiting" in queue, false);
    assert.equal("current" in queue, false);
    assert.equal(queue.live.patientStatus, "waiting");
    assert.equal(queue.live.ahead, 2);
    assert.equal(queue.live.etaMinutes, null);
    assert.equal(queue.status, "closed");
    assert.match(queue.live.message, /not started|closed/i);

    await jsonRequest(`${url}/api/auth/send-otp`, "POST", { phone: "9234567890" });
    const otherPatientLogin = await jsonRequest(`${url}/api/auth/verify-otp`, "POST", { phone: "9234567890", otp: "123456" }).then(response => response.json());
    const privateQueue = await fetch(`${url}/api/queues/doctor-real-1?date=2026-08-06&token=T003`, { headers: { Authorization: `Bearer ${otherPatientLogin.token}` } });
    assert.equal(privateQueue.status, 404);

    const startQueue = await jsonRequest(`${url}/api/doctor/queue/start`, "POST", { date: "2026-08-06" }, login.token);
    assert.equal(startQueue.status, 200);
    const startedPatientQueue = await fetch(`${url}/api/queues/doctor-real-1?date=2026-08-06&token=T003`, { headers: { Authorization: `Bearer ${patientLogin.token}` } }).then(response => response.json());
    assert.equal(startedPatientQueue.status, "live");
    assert.equal(startedPatientQueue.live.etaMinutes, 30);
    assert.match(startedPatientQueue.live.message, /2 patients ahead/i);
    const nextQueue = await jsonRequest(`${url}/api/doctor/queue/next`, "POST", { date: "2026-08-06" }, login.token);
    const liveQueue = await nextQueue.json();
    assert.equal(nextQueue.status, 200);
    assert.equal(liveQueue.current.token, "T001");
    assert.equal(liveQueue.waiting.length, 2);

    const currentPatientQueue = await fetch(`${url}/api/queues/doctor-real-1?date=2026-08-06&token=T001`, { headers: { Authorization: `Bearer ${patientLogin.token}` } }).then(response => response.json());
    assert.equal(currentPatientQueue.status, "live");
    assert.equal(currentPatientQueue.live.patientStatus, "in-progress");
    assert.equal(currentPatientQueue.live.ahead, 0);
    assert.equal(currentPatientQueue.live.etaMinutes, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
