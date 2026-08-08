import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("patient, doctor and receptionist portals are installable isolated PWAs", async () => {
  const [patientHtml, doctorHtml, receptionistHtml, patientManifestRaw, doctorManifestRaw, receptionistManifestRaw, patientWorker, doctorWorker, receptionistWorker, adminWorker, installer] = await Promise.all([
    readFile("patient_app/index.html", "utf8"),
    readFile("doctor_app/index.html", "utf8"),
    readFile("receptionist_app/index.html", "utf8"),
    readFile("patient_app/manifest.json", "utf8"),
    readFile("doctor_app/manifest.json", "utf8"),
    readFile("receptionist_app/manifest.json", "utf8"),
    readFile("patient_app/sw.js", "utf8"),
    readFile("doctor_app/sw.js", "utf8"),
    readFile("receptionist_app/sw.js", "utf8"),
    readFile("admin_panel/sw.js", "utf8"),
    readFile("assets/pwa/install-prompt.js", "utf8")
  ]);
  const patientManifest = JSON.parse(patientManifestRaw);
  const doctorManifest = JSON.parse(doctorManifestRaw);
  const receptionistManifest = JSON.parse(receptionistManifestRaw);

  assert.equal(patientManifest.id, "/patient/");
  assert.equal(patientManifest.start_url, "/patient/#/home");
  assert.equal(patientManifest.scope, "/patient/");
  assert.equal(patientManifest.display, "standalone");
  assert.equal(doctorManifest.id, "/doctor/");
  assert.equal(doctorManifest.start_url, "/doctor/#dashboard");
  assert.equal(doctorManifest.scope, "/doctor/");
  assert.equal(doctorManifest.display, "standalone");
  assert.equal(receptionistManifest.id, "/receptionist/");
  assert.equal(receptionistManifest.start_url, "/receptionist/");
  assert.equal(receptionistManifest.scope, "/receptionist/");
  assert.equal(receptionistManifest.display, "standalone");
  assert.notEqual(patientManifest.id, doctorManifest.id);
  assert.notEqual(doctorManifest.id, receptionistManifest.id);
  assert.ok(patientManifest.icons.some(icon => icon.purpose === "maskable"));
  assert.ok(doctorManifest.icons.some(icon => icon.purpose === "maskable"));
  assert.ok(receptionistManifest.icons.some(icon => icon.purpose === "maskable"));
  assert.ok(patientManifest.icons.some(icon => icon.sizes === "192x192"));
  assert.ok(doctorManifest.icons.some(icon => icon.sizes === "192x192"));
  assert.ok(receptionistManifest.icons.some(icon => icon.sizes === "192x192"));

  for (const html of [patientHtml, doctorHtml, receptionistHtml]) {
    assert.match(html, /rel="manifest"/);
    assert.match(html, /rel="apple-touch-icon"/);
    assert.match(html, /assets\/pwa\/install-prompt\.css/);
    assert.match(html, /assets\/pwa\/install-prompt\.js/);
    assert.match(html, /data-pwa-name=/);
  }

  assert.match(installer, /beforeinstallprompt/);
  assert.match(installer, /appinstalled/);
  assert.match(installer, /Add to Home Screen/);
  assert.match(installer, /display-mode: standalone/);
  assert.match(patientWorker, /sehatline-patient-/);
  assert.match(doctorWorker, /sehatline-doctor-/);
  assert.match(receptionistWorker, /sehatline-receptionist-/);
  assert.match(adminWorker, /sehatline-admin-/);
  for (const worker of [patientWorker, doctorWorker, receptionistWorker, adminWorker]) {
    assert.match(worker, /key\.startsWith\(CACHE_PREFIX\)/);
  }
});
