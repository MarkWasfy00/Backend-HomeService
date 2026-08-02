import "dotenv/config";
import { z } from "zod";

// Every environment variable the app needs is declared here. If one is missing
// or malformed the process exits immediately with a readable message, instead
// of failing later with a confusing runtime error.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("Copy .env.example to .env and fill in the values.");
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
