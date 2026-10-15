import { HttpException } from "@nestjs/common";

/** Erro de API no formato { error: { code, message, details? } }. */
export class ApiError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(code: string, message: string) {
    super(401, code, message);
  }
}

export class MissingCredentialsError extends ApiError {
  constructor() {
    super(500, "missing_credentials", "WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID são obrigatórios para envio");
  }
}

export class ProviderError extends ApiError {
  constructor(message: string) {
    super(502, "provider_error", message);
  }
}
