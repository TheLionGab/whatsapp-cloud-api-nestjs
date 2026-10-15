import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/config.schema.js";
import { AUTH, closeTestApps, createTestApp, sign } from "./helpers.js";

afterEach(closeTestApps);

const http = (app: INestApplication) => request(app.getHttpServer());

function fakeFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("health", () => {
  it("responde ok", async () => {
    const res = await http(await createTestApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "whatsapp-cloud-api-node" });
  });
});

describe("webhook verify", () => {
  it("devolve challenge com token correto", async () => {
    const res = await http(await createTestApp())
      .get("/webhook")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "segredo", "hub.challenge": "abc" });
    expect(res.status).toBe(200);
    expect(res.text).toBe("abc");
  });

  it("nega token errado com 403", async () => {
    const res = await http(await createTestApp())
      .get("/webhook")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "errado", "hub.challenge": "abc" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "verify_failed", message: "verify_token inválido" } });
  });

  it("nega modo diferente de subscribe e challenge ausente com 403", async () => {
    const app = await createTestApp();
    const other = await http(app)
      .get("/webhook")
      .query({ "hub.mode": "unsubscribe", "hub.verify_token": "segredo", "hub.challenge": "abc" });
    expect(other.status).toBe(403);
    const noChallenge = await http(app)
      .get("/webhook")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "segredo" });
    expect(noChallenge.status).toBe(403);
  });
});

describe("webhook receive", () => {
  it("confirma recebimento", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const res = await http(await createTestApp())
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it("rejeita assinatura ausente, errada ou de outro corpo com 401", async () => {
    const app = await createTestApp();
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const send = (sig?: string) => {
      const r = http(app).post("/webhook").set("Content-Type", "application/json");
      return (sig ? r.set("X-Hub-Signature-256", sig) : r).send(body);
    };
    const missing = await send();
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: { code: "invalid_signature", message: "assinatura inválida" } });
    expect((await send("sha256=deadbeef")).status).toBe(401);
    expect((await send(sign(body, "outro-segredo"))).status).toBe(401);
    expect((await send(sign('{"object":"x"}'))).status).toBe(401);
  });

  it("assina o corpo CRU: espaços e ordem de chaves contam", async () => {
    const app = await createTestApp();
    const raw = '{ "object" : "whatsapp_business_account" }';
    const ok = await http(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(raw))
      .send(raw);
    expect(ok.status).toBe(200);
    const reserialized = await http(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(JSON.stringify(JSON.parse(raw))))
      .send(raw);
    expect(reserialized.status).toBe(401);
  });

  it("sem app secret (dry-run) aceita sem assinatura", async () => {
    const app = await createTestApp({ config: { dryRun: true, appSecret: "", sendApiKey: "" } });
    const res = await http(app).post("/webhook").send({ object: "x" });
    expect(res.status).toBe(200);
  });

  it("JSON malformado vira 400 no formato de erro", async () => {
    const res = await http(await createTestApp())
      .post("/webhook")
      .set("Content-Type", "application/json")
      .send("{nao-e-json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("http_error");
  });
});

describe("messages/text", () => {
  it("rejeita corpo inválido com 400", async () => {
    const res = await http(await createTestApp()).post("/messages/text").set(AUTH).send({ to: "abc", body: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_body");
    expect(res.body.error.message).toBe("corpo inválido");
    expect(res.body.error.details.fieldErrors).toHaveProperty("to");
    expect(res.body.error.details.fieldErrors).toHaveProperty("body");
  });

  it("sem corpo JSON também é 400 invalid_body", async () => {
    const res = await http(await createTestApp()).post("/messages/text").set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_body");
  });

  it("envia via Graph API com fetch injetado", async () => {
    const { impl, calls } = fakeFetch({ ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.1" }] }) });
    const res = await http(await createTestApp({ fetchImpl: impl }))
      .post("/messages/text")
      .set(AUTH)
      .send({ to: "5565999990000", body: "olá" });
    expect(res.status).toBe(200);
    expect(res.body.providerId).toBe("wamid.1");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("graph.facebook.com/v22.0/123/messages");
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: "Bearer test-token" });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      messaging_product: "whatsapp",
      to: "5565999990000",
      type: "text",
      text: { body: "olá", preview_url: false },
    });
  });

  it("exige a chave de envio: 401 sem ela ou com chave errada", async () => {
    const app = await createTestApp();
    const payload = { to: "5565999990000", body: "olá" };
    expect((await http(app).post("/messages/text").send(payload)).status).toBe(401);
    const wrong = await http(app).post("/messages/text").set("Authorization", "Bearer outra").send(payload);
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("unauthorized");
  });

  it("a chave é conferida antes da validação do corpo", async () => {
    const res = await http(await createTestApp()).post("/messages/text").send({ to: "abc" });
    expect(res.status).toBe(401);
  });

  it("modo dry-run responde sem chamar provider", async () => {
    const { impl, calls } = fakeFetch({ ok: true, status: 200, json: async () => ({}) });
    const app = await createTestApp({ config: { dryRun: true }, fetchImpl: impl });
    const res = await http(app).post("/messages/text").set(AUTH).send({ to: "5565999990000", body: "oi" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      providerId: "dry-run-wamid.123",
      provider: { dryRun: true, to: "5565999990000", body: "oi" },
    });
    expect(calls).toHaveLength(0);
  });

  it("retorna 502 quando provider falha", async () => {
    const { impl } = fakeFetch({ ok: false, status: 400, json: async () => ({ error: { message: "número inválido" } }) });
    const res = await http(await createTestApp({ fetchImpl: impl }))
      .post("/messages/text")
      .set(AUTH)
      .send({ to: "5565999990000", body: "olá" });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: { code: "provider_error", message: "número inválido" } });
  });

  it("retorna 502 quando o fetch lança (rede)", async () => {
    const impl = (async () => {
      throw new Error("fetch failed");
    }) as unknown as typeof fetch;
    const res = await http(await createTestApp({ fetchImpl: impl }))
      .post("/messages/text")
      .set(AUTH)
      .send({ to: "5565999990000", body: "olá" });
    expect(res.status).toBe(502);
    expect(res.body.error).toEqual({ code: "provider_error", message: "fetch failed" });
  });

  it("retorna 500 missing_credentials sem token da Meta", async () => {
    const app = await createTestApp({ config: { whatsappToken: "" } });
    const res = await http(app).post("/messages/text").set(AUTH).send({ to: "5565999990000", body: "olá" });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("missing_credentials");
  });
});

describe("erros gerais", () => {
  it("rota inexistente responde no formato de erro", async () => {
    const res = await http(await createTestApp()).get("/nao-existe");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});

describe("config", () => {
  it("não sobe sem verify token", () => {
    expect(() => loadConfig({ DRY_RUN: "true" })).toThrow();
  });

  it("fora do dry-run exige app secret e chave de envio", () => {
    expect(() => loadConfig({ WHATSAPP_VERIFY_TOKEN: "v" })).toThrow(/obrigatórios/);
    expect(() =>
      loadConfig({ WHATSAPP_VERIFY_TOKEN: "v", WHATSAPP_APP_SECRET: "s", SEND_API_KEY: "k" }),
    ).not.toThrow();
  });

  it("no dry-run dispensa os dois", () => {
    expect(() => loadConfig({ WHATSAPP_VERIFY_TOKEN: "v", DRY_RUN: "true" })).not.toThrow();
  });
});
