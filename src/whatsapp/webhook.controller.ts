import { Body, Controller, Get, HttpCode, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ApiError } from "../common/api-error.js";
import { safeEqual } from "../common/security.js";
import { APP_CONFIG } from "../config/config.constants.js";
import type { AppConfig } from "../config/config.schema.js";
import { WebhookSignatureGuard } from "./webhook-signature.guard.js";

@Controller("webhook")
export class WebhookController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WebhookController.name);
  }

  /** Verificação do webhook (a Meta chama 1x ao cadastrar a URL). */
  @Get()
  verify(@Query() query: Record<string, unknown>): string {
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];
    if (
      mode === "subscribe" &&
      typeof token === "string" &&
      safeEqual(token, this.config.verifyToken) &&
      typeof challenge === "string"
    ) {
      return challenge;
    }
    throw new ApiError(403, "verify_failed", "verify_token inválido");
  }

  /** Recepção de eventos (mensagens recebidas, status de entrega/leitura). */
  @Post()
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  receive(@Body() body: { object?: unknown; entry?: unknown } | undefined): { received: true } {
    // Só metadados: o corpo traz telefone e texto de terceiros e não vai para o log.
    this.logger.info(
      { object: body?.object, entries: Array.isArray(body?.entry) ? body.entry.length : 0 },
      "webhook recebido",
    );
    return { received: true };
  }
}
