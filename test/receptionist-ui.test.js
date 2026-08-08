import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Receptionist Portal has secure owner-approved clinic workflows without demo records", async () => {
  const [html, script, styles] = await Promise.all([
    readFile("receptionist_app/index.html", "utf8"),
    readFile("receptionist_app/app.js", "utf8"),
    readFile("receptionist_app/styles.css", "utf8")
  ]);

  assert.match(html, /OWNER-APPROVED ACCESS/);
  assert.match(html, /id="loginForm"/);
  assert.match(html, /id="passwordForm"/);
  assert.doesNotMatch(html, /id="[^"]*signup|<form[^>]+signup/i);
  assert.match(script, /\/receptionist\/dashboard/);
  assert.match(script, /\/receptionist\/walk-ins/);
  assert.match(script, /\/receptionist\/queue\//);
  assert.match(script, /assigned clinic workspace/i);
  assert.doesNotMatch(script, /Dr\. Demo|Demo Patient|demo mode/i);
  assert.match(styles, /@media\(max-width:820px\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});
