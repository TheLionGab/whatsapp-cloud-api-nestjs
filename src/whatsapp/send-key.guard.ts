import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { UnauthorizedError } from "../common/api-error.js";
import { bearerToken, safeEqual } from "../common/security.js";
import { APP_CONFIG } from "../config/config.constants.js";
import type { AppConfig } from "../config/config.schema.js";

/** Exige `Authorization: Bearer <SEND_API_KEY>` (dispensado se a chave está vazia, só no dry-run). */
@Injectable()
export class SendKeyGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.sendApiKey) return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (!safeEqual(bearerToken(req.header("authorization")), this.config.sendApiKey)) {
      throw new UnauthorizedError("unauthorized", "chave de envio ausente ou inválida");
    }
    return true;
  }
}
