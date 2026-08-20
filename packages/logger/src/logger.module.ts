import { Global, Logger, Module } from "@nestjs/common";
import { logger } from "@logger/logger.ts";

@Global()
@Module({
  providers: [{ provide: Logger, useValue: logger }],
  exports: [Logger],
})
export class LoggerModule {}
