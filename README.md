# Deno Desktop Vue Hono NestJS Vite Starter

A scaffold for building cross-platform desktop applications with
[Deno Desktop](https://docs.deno.com/runtime/desktop/), Vue, Vite, NestJS, and
Hono.

This project demonstrates a desktop development workflow that keeps Deno APIs
and `Deno.BrowserWindow` bindings available while still providing Vite client
HMR. It also includes a custom server integration for Vue rendering, Hono
request handling, and NestJS application setup.

## What This Solves

Deno Desktop framework autodetection is convenient because it can start a
framework dev server and provide HMR. However, autodetection does not currently
provide a general user-owned startup hook where a framework-based application
can register `win.bind()` functions before the generated desktop entrypoint
runs during development.

This scaffold uses an explicit HMR entrypoint instead:

1. `framework-server.ts` starts the Vite development server.
2. Deno Desktop launches that entrypoint with `--hmr`.
3. NestJS creates the application context and the BrowserWindow provider
   registers native bindings.
4. Vite serves the Vue client and watches both client and server files.
5. Hono is used to create the server middleware for vite/Deno http service
6. Server changes recreate or repaint the BrowserWindow and trigger a client
   reload when required.

The approach side-steps the problems referenced here:

- [Setting up Deno Desktop](https://www.lostindetails.com/articles/Setting-up-Deno-Desktop)
- [Deno Desktop: combining bindings with framework autodetection](https://github.com/denoland/deno/discussions/36392)

## Stack

- **Runtime:** Deno with Deno Desktop
- **Frontend:** Vue 3 and Vite
- **Desktop window:** `Deno.BrowserWindow`
- **Application context:** NestJS 11
- **HTTP/server layer:** Hono
- **Validation and configuration:** Zod and `@nestjs/config`
- **Language:** TypeScript

## Requirements

Install a recent Deno release that includes Deno Desktop support. Deno 2.9 or
newer is recommended because the scaffold relies on the current Desktop and
Vite integration APIs.

Check the installation with:

```sh
deno --version
```

## Getting Started

Clone the repository and enter the project directory:

```sh
git clone https://github.com/victor-enogwe/deno-desktop-vue-hono-nestjs-vite-starter.git
cd deno-desktop-vue-hono-nestjs-vite-starter
```

Install and cache dependencies using the checked-in lockfile:

```sh
deno i
```

Start the desktop application in development mode:

```sh
deno run desktop dev
```

The application window should open. Changes to Vue files are handled by Vite
client HMR. Changes to files under `apps/desktop/src/server` cause the server
module to be reloaded and the BrowserWindow to be repainted or recreated.

## Common Commands

Run these commands from the repository root unless noted otherwise:

| Command                        | Purpose                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `deno run desktop dev`         | Start the desktop app with development HMR.                     |
| `deno run desktop dev:inspect` | Start development mode with the Deno inspector.                 |
| `deno run desktop build`       | Build the client and server bundles with Vite.                  |
| `deno run desktop compile`     | Build, then compile a production desktop executable/app bundle. |
| `deno fmt --check`             | Check Deno formatting.                                          |
| `deno fmt`                     | Format supported source files.                                  |
| `deno lint`                    | Run the configured Deno linter.                                 |

## Development and HMR

`framework-server.ts` starts Vite with the development mode configuration. The
custom Vite plugins in `apps/desktop/vite.config.ts` then:

- load the Hono server through Vite's SSR module runner;
- install the Hono request listener into Vite's middleware stack;
- serve assets in-memory via vite - so no precompilation required
- render the Vue application on the server and inject it into the HTML shell;
- watch `apps/desktop/src/server`
- re-render the BrowserWindow when server modules.

This explicit entrypoint is intentional. Passing `.` to `deno desktop` enables
framework autodetection, but it does not provide the same application-owned
startup location for registering custom bindings during framework HMR.

## Native Bindings

Native capabilities belong on the Deno side of the boundary. The BrowserWindow
is provided by NestJS in
[`apps/desktop/src/server/providers/browser-window.provider.ts`](apps/desktop/src/server/providers/browser-window.provider.ts),
and application startup registers bindings in
[`apps/desktop/src/server/desktop.module.ts`](apps/desktop/src/server/desktop.module.ts).

The example binding is named `performComputation`:

```ts
this.window.bind("performComputation", () => Promise.resolve("computed"));
```

## Project Layout

```text
.
├── deno.json                  # Workspace tasks, imports, permissions, tooling
├── deno.lock                  # Locked dependency graph
├── apps/
│   └── desktop/
│       ├── deno.json          # Desktop tasks and Deno Desktop metadata
│       ├── framework-server.ts # Vite startup entrypoint for desktop HMR
│       ├── vite.config.ts     # Client/SSR builds and server HMR integration
│       └── src/
│           ├── client/        # Vue application and browser assets
│           ├── server/        # NestJS, Hono, and BrowserWindow integration
│           └── types/         # Vite and global TypeScript declarations
└── packages/
		├── config/                # NestJS configuration module
		├── enums/                 # Shared environment/logger enums
		├── logger/                # NestJS logger module and implementation
		└── schemas/               # Shared Zod and environment schemas
```

### Request flow

In development, requests enter Vite, pass through the custom Hono middleware,
and are rendered by the server module in
[`apps/desktop/src/server/server.ts`](apps/desktop/src/server/server.ts). In a
production build, Vite emits `dist/client` and `dist/server`; the Hono server
serves the client output and the compiled desktop runtime loads the server
bundle.

## Building and Packaging

Build the production client and server bundles:

```sh
deno run desktop compile
```

The output is written under `dist` and contains the os-based application:

The configured output paths are:

- macOS: `dist/example.app`
- Windows: `dist/example.exe`
- Linux: `dist/example`

Compilation is platform-specific. Build on the target platform when producing
an artifact for distribution, and review Deno Desktop's packaging options
before publishing an application.

## Configuration and Permissions

Workspace-wide imports use Deno workspace aliases such as `workspace:*` and
package aliases such as `@example/schemas`. Keep package exports in each
package's `deno.json` up to date when adding public modules.

The desktop package currently grants environment, FFI, filesystem, process,
system, network, and write permissions through its `deno.json`. These are
appropriate for this scaffold's native desktop capabilities but should be
reduced for an application that does not need all of them. Prefer the narrowest
permissions possible as the application grows.

Validation schemas are located in [`packages/schemas/src`](packages/schemas/src)
. Do not commit `.env` files or secrets; local environment files are ignored by
Git.

## Contributing

Contributions are welcome. A useful contribution should be focused, documented,
and compatible with the Deno workspace conventions already used here.

1. Create a branch from `main`.
2. Make the smallest change that addresses the issue or feature.
3. Add or update tests for behavior that can be tested outside the desktop
   window.
4. Run formatting, linting, type checking, tests, and a production build.
5. Update this README when commands, architecture, permissions, or developer
   workflow changes.
6. Open a pull request with a clear description of the change and validation
   performed.

Before opening a pull request, run:

```sh
deno fmt --check
deno lint
deno check
deno test
deno run desktop build
```

For changes to desktop startup, BrowserWindow providers, Vite plugins, or HMR,
also test the interactive development command:

```sh
deno run desktop dev
```

and verify that the production app works as expected when compiled using:

```sh
deno run desktop dev
```

Verify both a Vue client edit and a server edit under
`apps/desktop/src/server` while the application is running.

### Contribution guidelines

- Preserve the separation between renderer code and Deno-native code.
- Prefer existing workspace aliases and package boundaries over relative
  imports that cross packages.
- Keep public APIs typed and validate external input at module boundaries.
- Avoid broad permission increases unless the feature requires them.
- Keep generated `dist`, coverage, and dependency directories out of commits.
- Explain platform-specific behavior and manual verification steps in the pull
  request.

## License

This project is distributed under the terms in
[`LICENSE`](LICENSE).
