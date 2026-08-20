import { createVueApp } from "@desktop/client/app.ts";
import { nestApp } from "@desktop/server/app.ts";
import type { BaseEnvSchema } from "@example/schemas/base-env";
import { ConfigService } from "@nestjs/config";
import { memoize } from "es-toolkit";
import { type Context, Env, Hono, Next } from "hono";
import { serveStatic } from "hono/deno";
import { etag } from "hono/etag";
import { lookup } from "mrmime";
import { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { ViteDevServer } from "vite";
import { renderToString } from "vue/server-renderer";

interface ViteEnv extends Env {
  Bindings?: {
    vite?: ViteDevServer;
    req?: IncomingMessage;
    res?: ServerResponse;
  };
}

const filePathRegex = /^\/.+(\.[A-Za-z]+)$/;
const configService = nestApp.get(ConfigService<BaseEnvSchema>);
const nodeEnv = configService.get("NODE_ENV");
const ssrMode = !!import.meta.hot;
const dirname = import.meta.dirname ?? "";
const rootDir = resolve(dirname, ssrMode ? "../.." : "..");
const clientDir = resolve(rootDir, "client");
const staticMiddleware = serveStatic({ root: clientDir });
const getMemoryFileKeyMap = memoize((rawFileKeys: string[]) => {
  return rawFileKeys.reduce<Record<string, string>>(
    (keys, key) => ({ ...keys, [removeViteHash(key)]: key }),
    {},
  );
});

function removeViteHash(filename: string): string {
  const segments = filename.split(".");

  if (segments.length < 2) return filename;

  const ext = segments.pop();
  const name = segments.join(".");
  const parts = name.split("-");

  if (parts.length < 2) return `${name}.${ext}`;

  const nameSansHash = parts.slice(0, -1).join("-");

  return `${nameSansHash}.${ext}`;
}

function getSsrTemplate({ env }: Context<ViteEnv>) {
  const vite = env?.vite;
  const bundledDev = vite?.environments.client.bundledDev;
  const memoryFiles = bundledDev?.memoryFiles;
  const htmlFile = memoryFiles?.get("index.html");

  return `${htmlFile?.source}`;
}

async function getCsrTemplate() {
  const path = resolve(clientDir, "index.html");

  return await Deno.readTextFile(path);
}

function createTemplate(template: string, ssrHtml: string): string {
  const html = template.replace(
    `<div id="app"></div>`,
    `<div id="app">${ssrHtml}</div>
    <!--hmr-script-->`,
  );

  return html;
}

async function renderVueApp(ctx: Context<ViteEnv>) {
  const { req, env } = ctx;
  const { url } = req;
  const context = { url, env: nodeEnv };
  const vite = env?.vite;
  const bundledDev = vite?.environments.client.bundledDev;
  const memoryFiles = bundledDev?.memoryFiles;
  const vueApp = createVueApp();

  let pageHtml = await renderToString(vueApp, context);

  if (!memoryFiles) return pageHtml;

  const rawFileKeys: string[] = [...Reflect.get(memoryFiles, "files").keys()];
  // @next-line warning - access vite's private API
  const fileKeys = getMemoryFileKeyMap(rawFileKeys);

  rawFileKeys.forEach((key) => {
    const filePath = removeViteHash(key);

    pageHtml = pageHtml.replaceAll(`/${filePath}`, `/${fileKeys[filePath]}`);
  });

  return pageHtml;
}

async function renderHtml(ctx: Context<ViteEnv>) {
  const { req, env } = ctx;
  const { url } = req;
  const vite = env?.vite;
  const template = vite?.hot ? getSsrTemplate(ctx) : await getCsrTemplate();
  const pageHtml = await renderVueApp(ctx);
  const html = createTemplate(template, pageHtml);

  if (vite?.hot) {
    const { pathname } = new URL(url);
    const ssrHtml = await vite.transformIndexHtml(pathname, html, url);

    return ssrHtml.replace(
      `<script type="module" src="/@vite/client"></script>`,
      "",
    );
  }

  return html;
}

function honoMemoryFilesMiddleware(ctx: Context<ViteEnv>, next: Next) {
  const { req, res } = ctx;
  const vite = ctx.env?.vite;
  const bundledDev = vite?.environments.client.bundledDev;
  const memoryFiles = bundledDev?.memoryFiles;
  const { pathname } = new URL(req.url);

  if (!memoryFiles) return next();

  const filePath = removeViteHash(pathname.slice(1)); // remove leading /
  // @next-line warning - access vite's private API war
  const rawFileKeys: string[] = [...Reflect.get(memoryFiles, "files").keys()];
  const fileKeys = getMemoryFileKeyMap(rawFileKeys);
  const fileKey = fileKeys[filePath];
  const file = memoryFiles.get(fileKey);
  const mime = lookup(fileKey);

  if (mime) res.headers.set("Content-Type", mime);

  if (file) {
    if (file.etag) res.headers.set("Etag", file.etag);

    const headers = vite?.config.server.headers;

    for (const name in headers) {
      const header = headers[name];

      if (header) res.headers.set(name, header as string);
    }

    ctx.env?.res?.on("finish", () => bundledDev.markPayloadDelivered(fileKey));

    return ctx.body(file.source as string);
  }

  return next();
}

async function honoWildcardMiddleware(ctx: Context<ViteEnv>, next: Next) {
  const { req } = ctx;
  const { pathname } = new URL(req.url);
  const isFile = filePathRegex.test(pathname);
  const vite = ctx.env?.vite;

  if (pathname.endsWith(".html")) return next();

  if (isFile) {
    if (!vite?.hot) return await staticMiddleware(ctx, next);

    return honoMemoryFilesMiddleware(ctx, next);
  }

  return ctx.html(await renderHtml(ctx));
}

export const httpServer = new Hono();

httpServer.use("*", etag());
httpServer.get("*", honoWildcardMiddleware);

if (import.meta.main) Deno.serve(httpServer.fetch);
