import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthController } from "./health/health.controller.js";
import { LoggingModule } from "./logging/logging.module.js";
import { WhatsappModule } from "./whatsapp/whatsapp.module.js";

@Module({
  imports: [ConfigModule, LoggingModule, WhatsappModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
