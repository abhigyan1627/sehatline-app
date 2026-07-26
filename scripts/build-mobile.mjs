import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const apiBaseUrl = String(process.env.SEHATLINE_API_URL || "").replace(/\/+$/, "");

if (!apiBaseUrl || !/^https:\/\//i.test(apiBaseUrl)) {
  throw new Error("Set SEHATLINE_API_URL to the production HTTPS backend before building.");
}

const apps = [
  { source: "patient_app", target: "dist/patient" },
  { source: "doctor_app", target: "dist/doctor" }
];

const productionDemoData = {
  patient_app: `const seed = {
  doctors: [],
  labs: [],
  appointments: [],
  reports: [],
  notifications: []
};`,
  doctor_app: `const demoData = {
    dashboard: { metrics: [] },
    appointments: [],
    queue: { status: "closed", current: null, waiting: [], seen: 0, averageMinutes: 0, expectedMinutes: 15, elapsedSeconds: 0, delayMinutes: 0 },
    patients: [],
    profile: { name: "", specialisation: "", availability: [], holidays: [], services: [] },
    analytics: { totalBookings: 0, repeatPatients: "0%", revenue: "₹0", rating: "0", cancellationRate: "0%" }
  };`
};

function replaceMarkedBlock(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Missing production strip markers: ${startMarker}`);
  return `${source.slice(0, start)}${replacement}${source.slice(end + endMarker.length)}`;
}

await rm(path.join(root, "dist"), { recursive: true, force: true });

for (const app of apps) {
  const source = path.join(root, app.source);
  const target = path.join(root, app.target);
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
  await cp(
    path.join(root, "assets", "brand-motion"),
    path.join(target, "assets", "brand-motion"),
    { recursive: true }
  );
  await cp(
    path.join(root, "assets", "logos"),
    path.join(target, "assets", "logos"),
    { recursive: true }
  );
  const appScript = path.join(target, "app.js");
  const appScriptSource = await readFile(appScript, "utf8");
  await writeFile(
    appScript,
    replaceMarkedBlock(appScriptSource, "/* DEMO_DATA_START */", "/* DEMO_DATA_END */", productionDemoData[app.source]),
    "utf8"
  );
  if (app.source === "doctor_app") {
    const appHtml = path.join(target, "index.html");
    let htmlSource = await readFile(appHtml, "utf8");
    while (htmlSource.includes("<!-- DEMO_UI_START -->")) {
      htmlSource = replaceMarkedBlock(htmlSource, "<!-- DEMO_UI_START -->", "<!-- DEMO_UI_END -->", "");
    }
    await writeFile(appHtml, htmlSource, "utf8");
  }
  await writeFile(
    path.join(target, "config.js"),
    `window.SEHATLINE_CONFIG = Object.freeze(${JSON.stringify({
      mode: "production",
      apiBaseUrl,
      allowGuestAccess: false
    }, null, 2)});\n`,
    "utf8"
  );

  const serviceWorker = path.join(target, "sw.js");
  const serviceWorkerSource = await readFile(serviceWorker, "utf8");
  await writeFile(serviceWorker, serviceWorkerSource, "utf8");
}

console.log(`Production mobile assets created for ${apiBaseUrl}`);
