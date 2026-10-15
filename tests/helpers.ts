import { createHmac } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { DestinationStream } from "pino";
import { AppModule } from "../src/app.module.js";
import { appOptions } from "../src/app.options.js";
import { APP_CONFIG } from "../src/config/config.constants.js";
import type { AppConfig } from "../src/config/config.schema.js";
import { LOG_STREAM } from "../src/logging/logging.module.js";
import { FETCH } from "../src/whatsapp/fetch.token.js";

export const baseConfig: AppConfig = {
  port: 3000,
  whatsappToken: "test-token",
  phoneNumberId: "123",
  verifyToken: "segredo",
  graphVersion: "v22.0",
  appSecret: "app-secret",
  sendApiKey: "send-key",
  dryRun: false,
};

export const AUTH = { Authorization: "Bearer send-key" };

export function sign(body: string, secret = "app-secret"): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

export interface TestAppOptions {
  config?: Partial<AppConfig>;
  fetchImpl?: typeof fetch;
  logStream?: DestinationStream;
}

const apps: INestApplication[] = [];

/** App HTTP real (AppModule completo) com config e fetch trocados por DI. */
export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue({ ...baseConfig, ...options.config });
  if (options.fetchImpl) builder = builder.overrideProvider(FETCH).useValue(options.fetchImpl);
  if (options.logStream) builder = builder.overrideProvider(LOG_STREAM).useValue(options.logStream);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication(appOptions);
  await app.init();
  apps.push(app);
  return app;
}

export async function closeTestApps(): Promise<void> {
  await Promise.all(apps.splice(0).map((app) => app.close()));
}
