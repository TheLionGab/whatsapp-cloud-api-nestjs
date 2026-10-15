import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import pino, { type DestinationStream } from "pino";

/** Token opcional para capturar a saída do log nos testes. */
export const LOG_STREAM = Symbol("LOG_STREAM");

@Module({
  providers: [{ provide: LOG_STREAM, useValue: null }],
  exports: [LOG_STREAM],
})
class LogStreamModule {}

/**
 * O pino-http grava a URL e a query inteiras. Em GET /webhook a query traz o
 * hub.verify_token, então o log leva só o caminho e descarta query, params e o
 * endereço do cliente.
 */
function serializeReq(req: unknown): Record<string, unknown> {
  const s = pino.stdSerializers.req(req as Parameters<typeof pino.stdSerializers.req>[0]) as unknown as Record<string, unknown>;
  const { query: _q, params: _p, remoteAddress: _a, remotePort: _r, ...resto } = s;
  return { ...resto, url: typeof s["url"] === "string" ? s["url"].split("?")[0] : undefined };
}

function pinoHttpOptions() {
  return {
    level: process.env["LOG_LEVEL"] ?? "info",
    redact: ["req.headers.authorization", "req.headers.cookie", 'req.headers["x-hub-signature-256"]'],
    serializers: { req: serializeReq },
  };
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [LogStreamModule],
      inject: [LOG_STREAM],
      useFactory: (stream: DestinationStream | null) => ({
        pinoHttp: stream ? ([pinoHttpOptions(), stream] as [ReturnType<typeof pinoHttpOptions>, DestinationStream]) : pinoHttpOptions(),
      }),
    }),
  ],
})
export class LoggingModule {}
