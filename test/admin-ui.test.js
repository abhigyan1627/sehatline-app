import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Admin Portal uses separate connected documents without public signup", async () => {
  const [dashboard, login, passwordChange, dashboardScript, authScript, styles] = await Promise.all([
    readFile("admin_panel/index.html", "utf8"),
    readFile("admin_panel/login.html", "utf8"),
    readFile("admin_panel/change-password.html", "utf8"),
    readFile("admin_panel/app.js", "utf8"),
    readFile("admin_panel/auth.js", "utf8"),
    readFile("admin_panel/styles.css", "utf8")
  ]);

  assert.match(login, /id="adminLoginForm"/);
  assert.doesNotMatch(login, /id="adminAppShell"/);
  assert.match(login, /id="toggleAdminPassword"/);
  assert.match(login, /name="remember"/);
  assert.match(passwordChange, /id="adminPasswordChangeForm"/);
  assert.doesNotMatch(passwordChange, /id="adminAppShell"/);
  assert.match(dashboard, /id="view-admin-management"/);
  assert.match(dashboard, /id="view-audit-logs"/);
  assert.match(dashboard, /value="receptionist">Receptionist/);
  assert.match(dashboardScript, /assignedDoctorIds/);
  assert.doesNotMatch(login + passwordChange + dashboard, /id="adminSignupForm"/i);
  assert.doesNotMatch(login + passwordChange + dashboard, /Create your admin account/i);
  assert.match(authScript, /credentials:\s*"same-origin"/);
  assert.match(authScript, /X-Admin-CSRF/);
  assert.match(dashboardScript, /credentials:\s*"same-origin"/);
  assert.doesNotMatch(authScript + dashboardScript, /localStorage\.setItem\([^,]*(?:token|session|auth)/i);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /\.admin-auth-shell/);
});
