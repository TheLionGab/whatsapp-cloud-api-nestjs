import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import type { z } from "zod";
import { ApiError } from "./api-error.js";

/** Valida o corpo com um schema Zod; falha vira 400 invalid_body. */
export class ZodValidationPipe<T extends z.ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.infer<T> {
    // Sem corpo JSON o Express 5 deixa req.body indefinido; o Express 4 do
    // projeto irmão entregava {}. Normalizamos para manter a mesma resposta.
    const parsed = this.schema.safeParse(value ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "invalid_body", "corpo inválido", parsed.error.flatten());
    }
    return parsed.data;
  }
}
