import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startServer } from "../backend/src/server.js";

test("admin completes and verifies a doctor before public listing", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "sehatline-doctor-flow-"));
  const dataFile = path.join(tempDirectory, "runtime.json");
  const { server, url } = await startServer({ port: 0, dataFile, logger: { error() {} } });

  try {
    const initialDoctors = await fetch(`${url}/api/doctors`).then(response => response.json());
    assert.deepEqual(initialDoctors, []);

    const created = await fetch(`${url}/api/doctors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr. Flow Test",
        specialty: "General Physician",
        email: "private@example.test",
        documents: {
          registrationCertificate: { name: "Registration", url: "https://secure.example.test/registration" }
        }
      })
    }).then(response => response.json());

    assert.equal(created.status, "pending");
    assert.deepEqual(await fetch(`${url}/api/doctors`).then(response => response.json()), []);
    assert.equal((await fetch(`${url}/api/doctors?includePending=true`).then(response => response.json())).length, 1);

    const incompleteResponse = await fetch(`${url}/api/doctors/${created.id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    const incomplete = await incompleteResponse.json();
    assert.equal(incompleteResponse.status, 422);
    assert.ok(incomplete.error.details.includes("registrationNumber"));
    assert.ok(incomplete.error.details.includes("phone"));

    const completed = await fetch(`${url}/api/doctors/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+91 98765 43210",
        qualification: "MBBS, MD Medicine",
        fee: 400,
        experience: 5,
        clinic: "Flow Care Clinic",
        address: "Civil Lines, Prayagraj",
        location: "Prayagraj",
        city: "Prayagraj",
        pincode: "211001",
        languages: ["Hindi", "English"],
        registrationNumber: "UPMC-TEST-48291",
        registrationCouncil: "Uttar Pradesh Medical Council",
        documents: {
          registrationCertificate: {
            name: "Registration",
            url: "https://secure.example.test/registration"
          },
          degreeCertificate: {
            name: "MBBS degree",
            url: "https://secure.example.test/degree"
          },
          photoId: {
            name: "Government ID",
            url: "https://secure.example.test/photo-id"
          }
        }
      })
    }).then(response => response.json());
    assert.equal(completed.status, "pending");

    const verified = await fetch(`${url}/api/doctors/${created.id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedBy: "Admin", approvalNote: "Documents checked manually" })
    }).then(response => response.json());

    assert.equal(verified.verified, true);
    assert.equal(verified.approvedBy, "Admin");

    const publicDoctors = await fetch(`${url}/api/doctors`).then(response => response.json());
    assert.equal(publicDoctors.length, 1);
    assert.equal(publicDoctors[0].registrationNumber, "UPMC-TEST-48291");
    assert.equal("phone" in publicDoctors[0], false);
    assert.equal("email" in publicDoctors[0], false);
    assert.equal("documents" in publicDoctors[0], false);

    const adminDetail = await fetch(`${url}/api/doctors/${created.id}?includePending=true`).then(response => response.json());
    assert.equal(adminDetail.phone, "+91 98765 43210");
    assert.equal(adminDetail.email, "private@example.test");
    assert.equal(adminDetail.documents.registrationCertificate.name, "Registration");

    const rejectedApplication = await fetch(`${url}/api/doctors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dr. Rejected Test", specialty: "Physician" })
    }).then(response => response.json());
    const rejected = await fetch(`${url}/api/doctors/${rejectedApplication.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Registration proof could not be verified", rejectedBy: "Admin" })
    }).then(response => response.json());
    assert.equal(rejected.status, "rejected");
    assert.equal((await fetch(`${url}/api/doctors`).then(response => response.json())).length, 1);
    assert.equal((await fetch(`${url}/api/doctors/${rejectedApplication.id}`)).status, 404);

    const removed = await fetch(`${url}/api/doctors/${created.id}`, { method: "DELETE" });
    assert.equal(removed.ok, true);
    assert.equal((await fetch(`${url}/api/doctors/${rejectedApplication.id}`, { method: "DELETE" })).ok, true);
    assert.deepEqual(await fetch(`${url}/api/doctors?includePending=true`).then(response => response.json()), []);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
