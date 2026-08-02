import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { pgConnectionConfig } from "./db-url.js";
import { env, isProduction } from "./env.js";

// Prisma 7 talks to the database through a driver adapter. DATABASE_URL goes
// through pgConnectionConfig first because pg reads `sslmode` differently from
// the Prisma CLI - see the comment in db-url.ts.
const adapter = new PrismaPg(pgConnectionConfig(env.DATABASE_URL));

// Reuse a single client across hot reloads in development so we don't
// exhaust the database connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: isProduction ? ["error"] : ["query", "warn", "error"],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
