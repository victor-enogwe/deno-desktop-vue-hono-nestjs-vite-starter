import { type DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { logger } from "@example/logger/logger";
import { z, ZodObject } from "@example/schemas/zod";
import { join } from "node:path";

@Global()
@Module({})
export class ConfigModule {
  private static async validate<T extends z.core.$ZodLooseShape>(
    dto: ZodObject<T>,
    config: unknown,
    message: string,
  ) {
    const result = await dto.parseAsync(config, { reportInput: true });

    logger.debug(message);

    return result;
  }

  static forRoot<T extends z.core.$ZodLooseShape>(
    dto: ZodObject<T>,
    evnFilePath?: string | string[],
  ): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          envFilePath: evnFilePath ?? [
            join(
              Deno.mainModule.replace(/^(file:\/\/)|(src\/main\.ts$)/g, ""),
              ".env",
            ),
          ],
          validatePredefined: false,
          skipProcessEnv: true,
          load: [
            async (): Promise<unknown> => {
              logger.debug("Loading secrets from secrets manager...");

              return await ConfigModule.validate(
                dto,
                Deno.env.toObject(),
                "Secrets loaded from secrets manager.",
              );
            },
          ],
        }),
      ],
    };
  }
}
