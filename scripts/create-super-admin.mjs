import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { AdminAuthService } from "../backend/src/admin-auth.js";
import { JsonStore, MongoStore } from "../backend/src/store.js";
import { connectDatabase } from "../backend/src/config/database.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadEnvironment() {
  try {
    const content = await readFile(path.join(root, ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] != null) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function flag(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : "";
}

async function main() {
  await loadEnvironment();
  const terminal = createInterface({ input, output });
  let useMongo = false;
  try {
    const fullName = flag("name") || await terminal.question("Full name: ");
    const email = flag("email") || await terminal.question("Email: ");
    const mobile = flag("mobile") || await terminal.question("Mobile number: ");
    const password = process.env.SEHATLINE_SUPER_ADMIN_PASSWORD
      || flag("password")
      || await terminal.question("Initial strong password (input is visible): ");

    if (!process.env.SEHATLINE_SUPER_ADMIN_PASSWORD && !flag("password")) {
      output.write("Tip: set SEHATLINE_SUPER_ADMIN_PASSWORD temporarily to avoid visible password input.\n");
    }

    useMongo = Boolean(String(process.env.MONGODB_URI || "").trim()) && process.env.SEHATLINE_SKIP_DATABASE !== "true";
    if (useMongo) await connectDatabase();
    const store = useMongo ? new MongoStore() : new JsonStore();
    await store.initialize();
    const service = new AdminAuthService({
      store,
      jwtSecret: process.env.ADMIN_JWT_SECRET || randomBytes(48).toString("hex"),
      production: process.env.NODE_ENV === "production"
    });
    const result = await service.createFirstSuperAdmin({ fullName, email, mobile, password });
    output.write(`\nSuper Admin created securely.\nAdmin ID: ${result.admin.adminId}\n`);
    output.write("The password is stored only as a bcrypt hash. It must be changed on first login.\n");
  } finally {
    terminal.close();
    if (useMongo) await mongoose.disconnect();
    delete process.env.SEHATLINE_SUPER_ADMIN_PASSWORD;
  }
}

main().catch(error => {
  console.error(`Could not create Super Admin: ${error.message}`);
  process.exitCode = 1;
});
