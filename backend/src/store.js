import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSeedDatabase } from "./seed.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.resolve(sourceDirectory, "../data/runtime.json");

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
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryFile = `${this.filePath}.tmp`;
      await writeFile(temporaryFile, serialized, "utf8");
      await rename(temporaryFile, this.filePath);
    });
    await this.writeChain;
  }
}

export { defaultDataFile };
