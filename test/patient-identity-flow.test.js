import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startServer } from "../backend/src/server.js";

test("patient identity sandbox rejects raw Aadhaar and stores only verification status", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "sehatline-identity-flow-"));
  const dataFile = path.join(tempDirectory, "runtime.json");
  const { server, url } = await startServer({
    port: 0,
    dataFile,
    identitySandboxEnabled: true,
    logger: { error() {} }
  });

  try {
    const unsafeResponse = await fetch(`${url}/api/auth/patient/identity/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+91 98765 43210",
        consent: true,
        aadhaarNumber: "123412341234"
      })
    });
    assert.equal(unsafeResponse.status, 422);

    const faceUploadResponse = await fetch(`${url}/api/auth/patient/identity/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+91 98765 43210",
        consent: true,
        faceImage: "data:image/jpeg;base64,not-accepted"
      })
    });
    assert.equal(faceUploadResponse.status, 422);

    const startResponse = await fetch(`${url}/api/auth/patient/identity/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+91 98765 43210",
        consent: true,
        profile: {
          name: "Identity Test",
          dateOfBirth: "2000-01-01"
        }
      })
    });
    const started = await startResponse.json();
    assert.equal(startResponse.status, 201);
    assert.equal(started.sandbox, true);
    assert.ok(started.verificationId);

    const completeResponse = await fetch(`${url}/api/auth/patient/identity/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationId: started.verificationId })
    });
    const completed = await completeResponse.json();
    assert.equal(completeResponse.status, 200);
    assert.equal(completed.verified, true);
    assert.equal(completed.sandbox, true);
    assert.equal(completed.user.identityVerification.rawIdentityStored, false);

    const users = await fetch(`${url}/api/users`).then(response => response.json());
    const savedUser = users.find(user => String(user.phone || "").replace(/\D/g, "").endsWith("9876543210"));
    assert.ok(savedUser);
    assert.equal(savedUser.identityVerification.status, "sandbox-verified");
    assert.equal(savedUser.identityVerification.rawIdentityStored, false);

    const serialized = JSON.stringify(savedUser).toLowerCase();
    assert.equal(serialized.includes("123412341234"), false);
    assert.equal(serialized.includes("faceimage"), false);
    assert.equal(serialized.includes("selfie"), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
