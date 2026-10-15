import request from "supertest";
import { Writable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestApps, createTestApp, sign } from "./helpers.js";

// O nestjs-pino guarda o logger raiz num singleton do processo: o primeiro app
// criado define destino e nível. Por isso este arquivo tem um único app, e o
// vitest isola os módulos por arquivo.
beforeAll(() => {
  process.env["LOG_LEVEL"] = "info";
});
afterAll(closeTestApps);

describe("logging", () => {
  it("loga só object e número de entradas, com cabeçalhos mascarados", async () => {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    });
    const app = await createTestApp({ logStream });
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { messages: [{ from: "5565999990000", text: { body: "segredo-do-cliente" } }] } }] }],
    });
    const signature = sign(body);
    const res = await request(app.getHttpServer())
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("Authorization", "Bearer token-que-nao-pode-vazar")
      .set("X-Hub-Signature-256", signature)
      .send(body);
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));

    const records = lines.flatMap((l) => l.split("\n").filter(Boolean)).map((l) => JSON.parse(l) as Record<string, unknown>);
    const hook = records.find((r) => r["msg"] === "webhook recebido");
    expect(hook).toMatchObject({ object: "whatsapp_business_account", entries: 1 });
    const all = lines.join("");
    expect(all).not.toContain("segredo-do-cliente");
    expect(all).not.toContain("5565999990000");
    expect(all).not.toContain("token-que-nao-pode-vazar");
    expect(all).not.toContain(signature);
    const reqLog = records.find((r) => r["msg"] === "request completed");
    const headers = (reqLog?.["req"] as { headers: Record<string, string> }).headers;
    expect(headers["authorization"]).toBe("[Redacted]");
    expect(headers["x-hub-signature-256"]).toBe("[Redacted]");
  });
});
