import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("patient home focuses on verified doctor categories and upcoming services", async () => {
  const source = await readFile("patient_app/app.js", "utf8");

  assert.doesNotMatch(source, /id="homeAiForm"/);
  assert.doesNotMatch(source, />Compare Doctors</);
  assert.match(source, /Verified doctors/);
  assert.match(source, /Gynaecologist/);
  assert.match(source, /Skin & hair/);
  assert.match(source, /PathLabs/);
  assert.match(source, /Medicine delivery/);
  assert.match(source, /Free medical camps/);
  assert.match(source, /Critical care support/);
  assert.match(source, /Admin-verified fundraising/);
});
