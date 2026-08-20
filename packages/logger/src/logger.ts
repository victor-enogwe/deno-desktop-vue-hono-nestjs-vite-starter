import { ConsoleLogger } from "@nestjs/common";
import { NodeEnv } from "@example/enums/env";
import { baseEnvSchema } from "@example/schemas/base-env";

const env = Deno.env.get("NODE_ENV");
const logLevel = Deno.env.get("LOG_LEVEL");

const isTest = env === NodeEnv.TEST;

export const level = baseEnvSchema.shape.LOG_LEVEL.parse(logLevel);

export const logger = new Proxy(
  new ConsoleLogger({
    context: "Deno Desktop",
    forceConsole: isTest,
    logLevels: [level as "log"],
  }),
  {
    get(...args): unknown {
      const [target, prop] = args;

      if (prop === "printf") return target.log.bind(target);
      if (prop === "print") return target.log.bind(target);
      if (prop === "info") return target.log.bind(target);
      if (prop === "trace") return target.log.bind(target);
      if (prop === "child") return () => target;

      return Reflect.get(...args) as unknown;
    },
  },
);
