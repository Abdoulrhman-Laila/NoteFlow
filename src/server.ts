import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***");
}

async function start(): Promise<void> {
  await prisma.$connect();

  const server = app.listen(env.port, () => {
    console.log(`Task API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  function shutdown(signal: string): void {
    console.log(`Received ${signal}, shutting down`);
    server.close(() => {
      void prisma.$disconnect().finally(() => {
        process.exit(0);
      });
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error: unknown) => {
  console.error(`Failed to start the API: ${safeErrorMessage(error)}`);
  process.exit(1);
});
