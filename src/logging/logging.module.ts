import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import type { DestinationStream } from "pino";

/** Token opcional para capturar a saída do log nos testes. */
export const LOG_STREAM = Symbol("LOG_STREAM");

@Module({
  providers: [{ provide: LOG_STREAM, useValue: null }],
  exports: [LOG_STREAM],
})
class LogStreamModule {}

function pinoHttpOptions() {
  return {
    level: process.env["LOG_LEVEL"] ?? "info",
    redact: ["req.headers.authorization", 'req.headers["x-hub-signature-256"]'],
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
