import { DesktopModule } from "@desktop/server/desktop.module.ts";
import { logger } from "@example/logger/logger";
import { ShutdownSignal } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

export const nestApp = await NestFactory.createApplicationContext(
  DesktopModule,
  {
    bufferLogs: true,
    abortOnError: true,
    autoFlushLogs: true,
    logger,
  },
);

nestApp.enableShutdownHooks([
  ShutdownSignal.SIGHUP,
  ShutdownSignal.SIGINT,
  ShutdownSignal.SIGQUIT,
  ShutdownSignal.SIGTERM,
  ShutdownSignal.SIGABRT,
  ShutdownSignal.SIGBUS,
]);
