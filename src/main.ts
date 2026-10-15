import { existsSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { appOptions } from "./app.options.js";
import { APP_CONFIG } from "./config/config.constants.js";
import type { AppConfig } from "./config/config.schema.js";

// Carrega o arquivo de ambiente local se existir (não sobrescreve variáveis já definidas).
const envFile = [".", "env"].join("");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const app = await NestFactory.create(AppModule, { ...appOptions, bufferLogs: true });
const logger = app.get(Logger);
app.useLogger(logger);
app.enableShutdownHooks();

const { port } = app.get<AppConfig>(APP_CONFIG);
await app.listen(port);
logger.log(`whatsapp-cloud-api-nestjs ouvindo em :${port}`);
