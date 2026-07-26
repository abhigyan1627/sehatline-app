import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startServer } from "../backend/src/server.js";

test("AI does not mistake available for a lab request", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "sehatline-ai-query-"));
  const dataFile = path.join(tempDirectory, "runtime.json");
  const { server, url } = await startServer({ port: 0, dataFile, logger: { error() {} } });

  try {
    const doctorResponse = await fetch(`${url}/api/ai/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Doctor available today" })
    }).then(response => response.json());
    assert.equal(doctorResponse.type, "doctor");

    const labResponse = await fetch(`${url}/api/ai/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Cheapest thyroid test near me" })
    }).then(response => response.json());
    assert.equal(labResponse.type, "lab");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
