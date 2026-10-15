import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SendKeyGuard } from "./send-key.guard.js";
import { type SendTextInput, sendTextSchema } from "./schemas.js";
import { type SendResult, WhatsappService } from "./whatsapp.service.js";

@Controller("messages")
export class MessagesController {
  constructor(private readonly whatsapp: WhatsappService) {}

  /** Envio de texto via Cloud API. */
  @Post("text")
  @HttpCode(200)
  @UseGuards(SendKeyGuard)
  async sendText(@Body(new ZodValidationPipe(sendTextSchema)) input: SendTextInput): Promise<SendResult> {
    return this.whatsapp.sendText(input);
  }
}
