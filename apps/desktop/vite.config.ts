import deno from "@deno/vite-plugin";
import type { ModuleRunner } from "@desktop/types/vite.d.ts";
import { getRequestListener } from "@hono/node-server";
import type { NestApplication } from "@nestjs/core";
import vue from "@vitejs/plugin-vue";
import { partialRight } from "es-toolkit";
import type { Hono } from "hono";
import { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import {
  ConfigEnv,
  defineConfig,
  normalizePath,
  type Plugin,
  UserConfig,
  ViteDevServer,
} from "vite";

async function loadSSRModule<T>(server: ViteDevServer, ssrEntryPoint: string) {
  const { ssr } = server.environments;
  const runner = Reflect.get(ssr, "runner") as ModuleRunner;

  return await runner.import<T>(ssrEntryPoint);
}

function createDevServerMiddleware(
  vite: ViteDevServer,
  ssrModule: { httpServer: Hono },
) {
  getRequestListener;
  return (
    req: IncomingMessage,
    res: ServerResponse,
    next: (error?: unknown) => void,
  ) =>
    getRequestListener(async (request) => {
      const env = { req, res, vite };

      const response = await ssrModule.httpServer.fetch(request, env, {
        waitUntil: (fn) => fn,
        passThroughOnException: () => {
          throw new Error("`passThroughOnException` is not supported");
        },
        props: {},
      });

      if (!(response instanceof Response)) throw response;

      return response;
    }, {
      overrideGlobalObjects: false,
      errorHandler: next,
    })(req, res);
}

function html(): Plugin {
  const virtualId = "index.html";
  const indexHtml = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml"
      href="/src/client/assets/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>web</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" crossorigin src="/src/client/main.ts"></script>
  </body>
</html>`;

  return {
    name: "vite:virtual-index-html",
    resolveId(id) {
      if (id === "index.html" || id === "/index.html") return virtualId;

      return null;
    },
    load(id) {
      if (id !== virtualId) return null;

      return indexHtml;
    },
  };
}

function transformHtmlAssetUrls(): Plugin {
  const ssrRegex = /\/src\/client(\/assets)?/g;

  return {
    name: "vite:transform-html-asset-urls",
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        if (!context.server?.hot) return html;

        return html.replace(ssrRegex, "/assets");
      },
    },
  };
}

async function getBrowserWindow(
  server: ViteDevServer,
): Promise<Deno.BrowserWindow> {
  const { nestApp } = await loadSSRModule<{ nestApp: NestApplication }>(
    server,
    "@desktop/server/app.ts",
  );

  return nestApp.get(Deno.BrowserWindow);
}

function resetWinCache(winCache: Map<"main", Deno.BrowserWindow>) {
  const mainWindow = winCache.get("main");

  mainWindow?.close();
  winCache.delete("main");
}

async function repaintBrowserWindows(
  server: ViteDevServer,
  winCache: Map<"main", Deno.BrowserWindow>,
) {
  const serverUrl = server.httpServer?.address() as AddressInfo;
  const winUrl = `http://${serverUrl?.address}:${serverUrl?.port}/`;
  const newMainWindow = await getBrowserWindow(server);
  const mainWindow = winCache.getOrInsert("main", newMainWindow);

  if (mainWindow.windowId !== newMainWindow.windowId) {
    newMainWindow.setPosition(...mainWindow.getPosition());
    newMainWindow.navigate(winUrl);
    winCache.set("main", newMainWindow);
    mainWindow.close();
  } else {
    newMainWindow.navigate(winUrl);
  }
}

async function handleServerHmr(
  file: string,
  root: string,
  server: ViteDevServer,
  winCache: Map<"main", Deno.BrowserWindow>,
) {
  if (!file.startsWith(root)) return;

  await repaintBrowserWindows(server, winCache);

  // Trigger full browser reload
  server.ws.send({ type: "full-reload", path: "*" });
}

function server({ input }: { input: string }): Plugin {
  return {
    name: "vite:dev-server",
    enforce: "post",
    configureServer: async (server) => {
      await server.pluginContainer.buildStart({});

      const { httpServer, watcher, middlewares } = server;
      const ssrMod = await loadSSRModule<{ httpServer: Hono }>(server, input);
      const serverRoot = resolve(server.config.root, "src", "server");
      const mainWin = await getBrowserWindow(server);
      const winCache = new Map<"main", Deno.BrowserWindow>([["main", mainWin]]);
      const watch = partialRight(handleServerHmr, serverRoot, server, winCache);
      const repaint = partialRight(repaintBrowserWindows, server, winCache);

      watcher.add([serverRoot]);
      watcher.addListener("change", watch);
      middlewares.use(createDevServerMiddleware(server, ssrMod));
      httpServer?.addListener("close", partialRight(resetWinCache, winCache));
      httpServer?.addListener("listening", repaint);
    },
  };
}

export default defineConfig((env: ConfigEnv): UserConfig => {
  const isProduction = env.mode === "production";
  const dirname = import.meta.dirname ?? "";
  const ssrEntryPath = resolve(dirname, "src", "server", "server.ts");
  const ssrInput = normalizePath(ssrEntryPath);

  return {
    ...(isProduction ? { ssr: { noExternal: true } } : {}),
    base: "/",
    server: {
      fs: { strict: true },
      watch: {},
    },
    future: { removeSsrLoadModule: "warn" },
    environments: {
      ssr: {
        input: { server: ssrInput },
        optimizeDeps: { needsInterop: ["@nestjs/*"], entries: ["@nestjs/*"] },
        build: {
          ssr: true,
          minify: isProduction,
          outDir: Deno.env.get("SSR_OUT_DIR") ?? "dist/server",
          assetsDir: "./",
          emptyOutDir: Boolean(Deno.env.get("EMPTY_SSR_OUT_DIR")) ?? true,
          target: "node26",
          rolldownOptions: {
            output: {
              entryFileNames: "[name].mjs",
              chunkFileNames: "[name].mjs",
              assetFileNames: "[name].[ext]",
              strictExecutionOrder: true,
            },
            transform: {
              define: {
                __dirname: "import.meta.dirname",
              },
            },
          },
        },
      },
      client: {
        input: { main: "index.html" },
        build: {
          ssr: false,
          minify: isProduction,
          outDir: "dist/client",
          assetsDir: "./",
          rolldownOptions: {
            output: {
              hashCharacters: "hex",
              entryFileNames: "[name].js",
              chunkFileNames: "[name].js",
              assetFileNames: "[name].[ext]",
              strictExecutionOrder: true,
            },
          },
        },
      },
    },
    appType: "custom",
    mode: env.mode,
    optimizeDeps: {
      rolldownOptions: {
        output: { strictExecutionOrder: true },
        transform: { decorator: { emitDecoratorMetadata: true, legacy: true } },
      },
    },
    oxc: { decorator: { emitDecoratorMetadata: true, legacy: true } },
    experimental: { bundledDev: !isProduction },
    plugins: [
      html(),
      vue({ style: { trim: true }, isProduction }),
      deno(),
      transformHtmlAssetUrls(),
      server({ input: ssrInput }),
    ],
  };
});
