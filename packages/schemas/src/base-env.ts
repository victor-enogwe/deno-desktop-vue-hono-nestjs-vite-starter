import { LogLevel } from "@example/enums/logger";
import { nodeEnvSchema, timezoneSchema } from "@example/schemas/primitives";
import { z } from "@example/schemas/zod";

export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  TZ: timezoneSchema.default("UTC"),
  LOG_LEVEL: z.enum(LogLevel).default(LogLevel.ERROR),
});

export type BaseEnvSchema = z.infer<typeof baseEnvSchema>;
