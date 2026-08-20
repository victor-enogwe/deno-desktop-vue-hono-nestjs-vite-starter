import { Provider } from "@nestjs/common";

export const browserWindowProvider: Provider<Deno.BrowserWindow> = {
  provide: Deno.BrowserWindow,
  useFactory: () => {
    const title = "Deno Vite Vue NestJS Hono Application";

    const win = new Deno.BrowserWindow({
      title,
      x: 0,
      y: 0,
    });

    win.setTitle(`${title}: window(${win.windowId})`);

    return win;
  },
};
