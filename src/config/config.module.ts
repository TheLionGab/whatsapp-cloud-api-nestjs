import { Global, Module } from "@nestjs/common";
import { APP_CONFIG } from "./config.constants.js";
import { loadConfig } from "./config.schema.js";

/** Config validada por Zod, injetável pelo token APP_CONFIG. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
