import { baseEnvSchema } from "@example/schemas/base-env";
import z from "@example/schemas/zod";

export const desktopServiceSchema = z.object({
  ...baseEnvSchema.shape,
});

export type DesktopServiceSchema = z.infer<typeof desktopServiceSchema>;
