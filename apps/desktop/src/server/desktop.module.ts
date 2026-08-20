import { browserWindowProvider } from "@desktop/server/providers/browser-window.provider.ts";
import { MENU, menuProvider } from "@desktop/server/providers/menu.provider.ts";
import { ConfigModule } from "@example/config/config";
import { LoggerModule } from "@example/logger/logger-module";
import { desktopServiceSchema } from "@example/schemas/desktop-service";
import { Inject, Module, OnModuleDestroy } from "@nestjs/common";

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot(desktopServiceSchema),
  ],
  providers: [
    menuProvider,
    browserWindowProvider,
  ],
})
export class DesktopModule implements OnModuleDestroy {
  constructor(
    @Inject(MENU) private readonly menu: Deno.MenuItem[],
    private readonly window: Deno.BrowserWindow,
  ) {
    this.window.bind("performComputation", () => Promise.resolve("computed"));
    this.window.setApplicationMenu(this.menu);
  }

  onModuleDestroy() {
    this.window.close();
  }
}
