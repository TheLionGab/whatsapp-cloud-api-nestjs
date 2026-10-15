import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { UnauthorizedError } from "../common/api-error.js";
import { validSignature } from "../common/security.js";
import { APP_CONFIG } from "../config/config.constants.js";
import type { AppConfig } from "../config/config.schema.js";

/** Confere X-Hub-Signature-256 (HMAC-SHA256 do corpo CRU) quando há app secret. */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.appSecret) return true;
    const req = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const raw = req.rawBody ?? Buffer.alloc(0);
    if (!validSignature(this.config.appSecret, raw, req.header("x-hub-signature-256"))) {
      throw new UnauthorizedError("invalid_signature", "assinatura inválida");
    }
    return true;
  }
}
