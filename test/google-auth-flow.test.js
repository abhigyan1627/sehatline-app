import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startServer } from "../backend/src/server.js";

const postJson = (url, body, token = "") => fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify(body)
});

const encodePart = value => Buffer.from(JSON.stringify(value)).toString("base64url");

function signedGoogleToken(privateKey, payload) {
  const header = encodePart({ alg: "RS256", kid: "test-google-key", typ: "JWT" });
  const body = encodePart(payload);
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey).toString("base64url");
  return `${header}.${body}.${signature}`;
}

test("Google sign-in creates patient sessions and only admits approved doctor emails", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-google-auth-"));
  const profiles = {
    "patient-token": { sub: "google-patient-1", email: "Patient@Example.test", email_verified: true, name: "Google Patient" },
    "doctor-token": { sub: "google-doctor-1", email: "doctor@example.test", email_verified: true, name: "Approved Doctor" },
    "unknown-doctor-token": { sub: "google-doctor-2", email: "unknown@example.test", email_verified: true, name: "Unknown Doctor" }
  };
  const { server, store, url } = await startServer({
    port: 0,
    dataFile: path.join(directory, "runtime.json"),
    googleIdentityClientId: "test-client.apps.googleusercontent.com",
    verifyGoogleIdentityCredential: async credential => {
      if (!profiles[credential]) throw new Error("Invalid test token");
      return profiles[credential];
    },
    requirePatientAuth: true,
    requireDoctorAuth: true,
    logger: { error() {}, warn() {} }
  });

  try {
    await store.mutate(data => data.doctors.push({
      id: "doctor-google-1",
      name: "Dr. Google Approved",
      email: "Doctor@Example.test",
      phone: "+91 98765 43210",
      specialty: "General Physician",
      status: "verified",
      verified: true
    }));

    const configResponse = await fetch(`${url}/api/auth/google/config`);
    const config = await configResponse.json();
    assert.equal(configResponse.status, 200);
    assert.deepEqual(config, { enabled: true, clientId: "test-client.apps.googleusercontent.com" });

    const patientResponse = await postJson(`${url}/api/auth/google/patient`, { credential: "patient-token" });
    const patient = await patientResponse.json();
    assert.equal(patientResponse.status, 200);
    assert.match(patient.token, /^patient-/);
    assert.equal(patient.user.email, "patient@example.test");

    const protectedResponse = await fetch(`${url}/api/appointments`, {
      headers: { Authorization: `Bearer ${patient.token}` }
    });
    assert.equal(protectedResponse.status, 200);

    const doctorResponse = await postJson(`${url}/api/auth/google/doctor`, { credential: "doctor-token" });
    const doctor = await doctorResponse.json();
    assert.equal(doctorResponse.status, 200);
    assert.match(doctor.token, /^doctor-/);
    assert.equal(doctor.doctor.id, "doctor-google-1");

    const doctorDashboard = await fetch(`${url}/api/doctor/dashboard`, {
      headers: { Authorization: `Bearer ${doctor.token}` }
    });
    assert.equal(doctorDashboard.status, 200);

    const rejectedResponse = await postJson(`${url}/api/auth/google/doctor`, { credential: "unknown-doctor-token" });
    assert.equal(rejectedResponse.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("patient and doctor show Google sign-in while staff portals keep their existing authentication", async () => {
  const [patientJs, doctorHtml, receptionistHtml, adminLogin, footerStyles] = await Promise.all([
    readFile("patient_app/app.js", "utf8"),
    readFile("doctor_app/index.html", "utf8"),
    readFile("receptionist_app/index.html", "utf8"),
    readFile("admin_panel/login.html", "utf8"),
    readFile("assets/footer/site-footer.css", "utf8")
  ]);

  assert.match(patientJs, /patientGoogleButton/);
  assert.doesNotMatch(patientJs, /if \(!state\.authToken\) openAuth\(\);/);
  assert.match(doctorHtml, /doctor-google-button/);
  assert.doesNotMatch(receptionistHtml, /google-signin-slot/);
  assert.doesNotMatch(adminLogin, /google-signin-slot/);
  assert.match(footerStyles, /\.sehatline-social-link\.instagram svg,[\s\S]*stroke:currentColor/);
  assert.doesNotMatch(footerStyles, /#ee79b6|#4ade80|#25d366|#e85fa5/i);
});

test("default Google verifier checks the signature, issuer, audience and expiry", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-google-jwk-"));
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = { ...publicKey.export({ format: "jwk" }), kid: "test-google-key", alg: "RS256", use: "sig" };
  const clientId = "signed-test.apps.googleusercontent.com";
  const providerFetch = async url => {
    assert.equal(String(url), "https://www.googleapis.com/oauth2/v3/certs");
    return new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" }
    });
  };
  const { server, url } = await startServer({
    port: 0,
    dataFile: path.join(directory, "runtime.json"),
    googleIdentityClientId: clientId,
    providerFetch,
    logger: { error() {}, warn() {} }
  });

  try {
    const now = Math.floor(Date.now() / 1000);
    const validCredential = signedGoogleToken(privateKey, {
      iss: "https://accounts.google.com",
      aud: clientId,
      sub: "signed-patient",
      email: "signed@example.test",
      email_verified: true,
      iat: now - 5,
      exp: now + 600
    });
    const validResponse = await postJson(`${url}/api/auth/google/patient`, { credential: validCredential });
    assert.equal(validResponse.status, 200);

    const wrongAudienceCredential = signedGoogleToken(privateKey, {
      iss: "https://accounts.google.com",
      aud: "another-client.apps.googleusercontent.com",
      sub: "wrong-audience",
      email: "wrong@example.test",
      email_verified: true,
      iat: now - 5,
      exp: now + 600
    });
    const rejectedResponse = await postJson(`${url}/api/auth/google/patient`, { credential: wrongAudienceCredential });
    assert.equal(rejectedResponse.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
