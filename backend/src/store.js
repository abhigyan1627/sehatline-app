import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSeedDatabase } from "./seed.js";
import mongoose from "mongoose";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.resolve(sourceDirectory, "../data/runtime.json");
const TRANSIENT_FILE_ERRORS = new Set(["EACCES", "EBUSY", "EPERM"]);

async function retryTransientFileOperation(operation, attempts = 7) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!TRANSIENT_FILE_ERRORS.has(error?.code) || attempt === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
  throw lastError;
}

export class JsonStore {
  constructor(filePath = process.env.SEHATLINE_DATA_FILE || defaultDataFile) {
    this.filePath = path.resolve(filePath);
    this.data = null;
    this.writeChain = Promise.resolve();
  }

  async initialize() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.data = JSON.parse(raw);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`SehatLine data file is corrupt and was preserved at ${this.filePath}`, { cause: error });
      }
      if (error.code !== "ENOENT") throw error;
      this.data = createSeedDatabase();
      await this.persist();
    }
    ensureEcosystemCollections(this.data);
    return this.data;
  }

  snapshot() {
    if (!this.data) throw new Error("Store has not been initialized");
    return this.data;
  }

  async reset() {
    this.data = createSeedDatabase();
    await this.persist();
    return this.data;
  }

  async mutate(mutator) {
    if (!this.data) throw new Error("Store has not been initialized");
    const result = await mutator(this.data);
    this.data.meta = {
      ...(this.data.meta || {}),
      updatedAt: new Date().toISOString()
    };
    await this.persist();
    return result;
  }

  async persist() {
    const serialized = `${JSON.stringify(this.data, null, 2)}\n`;
    const operation = this.writeChain.catch(() => {}).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryFile = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await retryTransientFileOperation(() => writeFile(temporaryFile, serialized, "utf8"));
        try {
          await retryTransientFileOperation(() => rename(temporaryFile, this.filePath));
        } catch (error) {
          if (!TRANSIENT_FILE_ERRORS.has(error?.code)) throw error;
          // OneDrive and antivirus scanners can briefly lock an existing destination
          // on Windows. Direct overwrite is a safe final fallback after atomic retries.
          await retryTransientFileOperation(() => writeFile(this.filePath, serialized, "utf8"));
        }
      } finally {
        await unlink(temporaryFile).catch(error => {
          if (error?.code !== "ENOENT") return undefined;
          return undefined;
        });
      }
    });
    this.writeChain = operation;
    await operation;
  }
}

export class MongoStore {
  constructor(documentId = process.env.SEHATLINE_DATABASE_ID || "primary") {
    this.documentId = documentId;
    this.data = null;
    this.writeChain = Promise.resolve();
    this.model = null;
  }

  async initialize() {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB must be connected before MongoStore initializes");
    }
    const schema = new mongoose.Schema({
      _id: { type: String, required: true },
      data: { type: mongoose.Schema.Types.Mixed, required: true }
    }, { versionKey: false, collection: "platform_state" });
    this.model = mongoose.models.SehatLinePlatformState || mongoose.model("SehatLinePlatformState", schema);
    const existing = await this.model.findById(this.documentId).lean();
    this.data = existing?.data || createSeedDatabase();
    if (!existing) await this.persist();
    ensureEcosystemCollections(this.data);
    return this.data;
  }

  snapshot() {
    if (!this.data) throw new Error("Store has not been initialized");
    return this.data;
  }

  async reset() {
    this.data = createSeedDatabase();
    await this.persist();
    return this.data;
  }

  async mutate(mutator) {
    if (!this.data) throw new Error("Store has not been initialized");
    const result = await mutator(this.data);
    this.data.meta = { ...(this.data.meta || {}), updatedAt: new Date().toISOString() };
    await this.persist();
    return result;
  }

  async persist() {
    if (!this.model) throw new Error("MongoStore has not been initialized");
    const snapshot = JSON.parse(JSON.stringify(this.data));
    const operation = this.writeChain.catch(() => {}).then(() => this.model.updateOne(
      { _id: this.documentId },
      { $set: { data: snapshot } },
      { upsert: true }
    ));
    this.writeChain = operation;
    await operation;
  }
}

export { defaultDataFile };

function ensureEcosystemCollections(data) {
  for (const key of ["publicFacilities", "healthSupportLocations", "governmentSchemes", "insurancePlans"]) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  for (const patient of data.users || []) {
    for (const key of ["savedPublicFacilities", "savedHealthSupportLocations", "savedSchemes", "savedInsurancePlans"]) {
      if (!Array.isArray(patient[key])) patient[key] = [];
    }
  }
}
