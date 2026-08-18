import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const portals = ["patient_app", "doctor_app", "receptionist_app", "admin_panel"];

test("every existing portal loads the shared motion system", async () => {
  const pages = await Promise.all(portals.map(portal => readFile(`${portal}/index.html`, "utf8")));
  pages.forEach((page, index) => {
    assert.match(page, /\/assets\/motion\/sehatline-motion\.css/);
    assert.match(page, /\/assets\/motion\/sehatline-motion\.js/);
    assert.ok(
      page.indexOf("sehatline-motion.js") < page.indexOf("app.js"),
      `${portals[index]} must initialize motion before its application script`
    );
  });
});

test("motion foundation is accessible and transform-first", async () => {
  const [styles, script] = await Promise.all([
    readFile("assets/motion/sehatline-motion.css", "utf8"),
    readFile("assets/motion/sehatline-motion.js", "utf8")
  ]);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /translate3d/);
  assert.match(styles, /animation-play-state:\s*paused/);
  assert.match(styles, /\*,\s*\*::before,\s*\*::after\s*\{[^}]*-webkit-tap-highlight-color:\s*transparent/s);
  assert.match(styles, /touch-action:\s*manipulation/);
  assert.match(script, /visibilitychange/);
  assert.match(script, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.doesNotMatch(script, /setInterval/);
});

test("public workspace cards use SehatLine motion without native blue tap flash", async () => {
  const page = await readFile("index.html", "utf8");
  assert.match(page, /\/assets\/motion\/sehatline-motion\.css/);
  assert.match(page, /\/assets\/motion\/sehatline-motion\.js/);
  assert.match(page, /\.portal:active\{/);
});

test("offline shells cache shared motion assets", async () => {
  const workers = await Promise.all(portals.map(portal => readFile(`${portal}/sw.js`, "utf8")));
  workers.forEach(worker => {
    assert.match(worker, /\/assets\/motion\/sehatline-motion\.css/);
    assert.match(worker, /\/assets\/motion\/sehatline-motion\.js/);
  });
});
