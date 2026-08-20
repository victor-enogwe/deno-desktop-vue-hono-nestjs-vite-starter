import { z } from "zod";
import { en } from "zod/v4/locales";

z.config(en());

export * from "zod";
export { z, z as zod };
export default z;
