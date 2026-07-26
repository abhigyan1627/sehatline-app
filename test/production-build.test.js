import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("production mobile bundles exclude demo records and controls", async () => {
  const result = spawnSync(process.execPath, ["scripts/build-mobile.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, SEHATLINE_API_URL: "https://api.sehatline.invalid" },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const [patientJs, doctorJs, doctorHtml, patientConfig, doctorConfig] = await Promise.all([
    readFile("dist/patient/app.js", "utf8"),
    readFile("dist/doctor/app.js", "utf8"),
    readFile("dist/doctor/index.html", "utf8"),
    readFile("dist/patient/config.js", "utf8"),
    readFile("dist/doctor/config.js", "utf8")
  ]);

  assert.equal(patientJs.includes("Dr. Aditi Sharma"), false);
  assert.equal(doctorJs.includes("Meera Sethi"), false);
  assert.equal(doctorHtml.includes('id="demo-login"'), false);
  assert.match(patientConfig, /"mode": "production"/);
  assert.match(doctorConfig, /"allowGuestAccess": false/);
  assert.match(patientConfig, /https:\/\/api\.sehatline\.invalid/);
});
