import type { NestApplicationOptions } from "@nestjs/common";

/** rawBody: o guard do webhook assina o corpo CRU, não o JSON reserializado. */
export const appOptions = { rawBody: true } satisfies NestApplicationOptions;
