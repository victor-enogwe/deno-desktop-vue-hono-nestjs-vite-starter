// Cannot use node-specific imports in this file as it is used in both
// node and browser contexts
import { NodeEnv } from "@example/enums/env";
import { z } from "zod";

export const nodeEnvSchema = z.enum(NodeEnv).default(NodeEnv.TEST);

export const stringSchema = z.string().nonempty().meta({
  example: "lorem ipsum",
});

export const timezoneSchema = stringSchema
  .refine(
    (value) => {
      try {
        Temporal.Now.zonedDateTimeISO(value);

        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid IANA timezone identifier" },
  );
