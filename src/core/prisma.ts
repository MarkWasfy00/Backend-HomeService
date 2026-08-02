import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env, isProduction } from "./env.js";

// Prisma 7 talks to the database through a driver adapter.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

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
