import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { usersRouter } from "./routes/users.js";
import { prisma } from "./prisma.js";

export const app = express();

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Verifies the app can actually reach Postgres.
app.get("/health/db", async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "reachable" });
});

app.use("/users", usersRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
