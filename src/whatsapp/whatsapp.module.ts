import { Module } from "@nestjs/common";
import { FETCH } from "./fetch.token.js";
import { MessagesController } from "./messages.controller.js";
import { SendKeyGuard } from "./send-key.guard.js";
import { WebhookController } from "./webhook.controller.js";
import { WebhookSignatureGuard } from "./webhook-signature.guard.js";
import { WhatsappService } from "./whatsapp.service.js";

@Module({
  controllers: [WebhookController, MessagesController],
  providers: [
    WhatsappService,
    SendKeyGuard,
    WebhookSignatureGuard,
    // Late binding: resolve globalThis.fetch a cada chamada; testes trocam o token.
    { provide: FETCH, useValue: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) },
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {}
