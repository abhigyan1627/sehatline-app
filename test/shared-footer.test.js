import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("all SehatLine web surfaces load the shared office and contact footer", async () => {
  const pages = await Promise.all([
    "index.html",
    "patient_app/index.html",
    "doctor_app/index.html",
    "receptionist_app/index.html",
    "admin_panel/index.html",
    "admin_panel/login.html",
    "admin_panel/change-password.html"
  ].map(file => readFile(file, "utf8")));
  const [script, styles, patientWorker, doctorWorker, receptionistWorker, adminWorker] = await Promise.all([
    readFile("assets/footer/site-footer.js", "utf8"),
    readFile("assets/footer/site-footer.css", "utf8"),
    readFile("patient_app/sw.js", "utf8"),
    readFile("doctor_app/sw.js", "utf8"),
    readFile("receptionist_app/sw.js", "utf8"),
    readFile("admin_panel/sw.js", "utf8")
  ]);

  for (const page of pages) {
    assert.match(page, /assets\/footer\/site-footer\.css/);
    assert.match(page, /assets\/footer\/site-footer\.js/);
  }
  assert.match(script, /About|connects patients/i);
  assert.match(script, /Gopalganj, Bihar 841428/);
  assert.match(script, /support@sehatline\.in/);
  assert.match(script, /Abhigyan Srivastava/);
  assert.match(script, /\+91 70618 63790/);
  assert.match(script, /About us/);
  assert.match(script, /Support &amp; care/);
  assert.match(script, /Patient App/);
  assert.match(script, /Doctor App/);
  assert.match(script, /Receptionist Portal/);
  assert.match(script, /Secure Admin Login/);
  assert.match(script, /medical emergency, call 112/i);
  assert.match(styles, /sehatline-footer-inner/);
  assert.match(styles, /sehatline-footer-careline/);
  for (const worker of [patientWorker, doctorWorker, receptionistWorker, adminWorker]) {
    assert.match(worker, /assets\/footer\/site-footer\.css/);
    assert.match(worker, /assets\/footer\/site-footer\.js/);
  }
});
