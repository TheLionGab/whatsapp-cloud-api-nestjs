import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";
import { ApiError } from "./api-error.js";

/** Converte toda exceção para o formato { error: { code, message } }. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiError) {
      res.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details === undefined ? {} : { details: exception.details }),
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      // 404 de rota, 400 de JSON malformado, 413 etc. gerados pelo framework.
      const status = exception.getStatus();
      res.status(status).json({
        error: { code: status === 404 ? "not_found" : "http_error", message: exception.message },
      });
      return;
    }

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: "internal_error", message: "erro interno" },
    });
  }
}
