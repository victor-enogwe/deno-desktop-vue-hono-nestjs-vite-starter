import { createServer } from "vite";

const vite = createServer({ mode: "development" });

vite.then((server) => server.httpServer?.listen());
