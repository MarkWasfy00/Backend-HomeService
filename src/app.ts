// Must be first: teaches JSON.stringify how to handle BigInt ids.
import "./core/serialize.js";

import express, { type Request, type Response } from "express";
import { apiRouter } from "./api/index.js";
import { prisma } from "./core/prisma.js";
import { errorHandler, notFoundHandler } from "./core/error-handler.js";

export const app = express();

app.use(express.json());

// Infrastructure checks, deliberately outside /api so monitoring tools and
// load balancers can reach them without a version or a token.
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Verifies the app can actually reach Postgres.
app.get("/health/db", async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "reachable" });
});

// The entire API, grouped by audience. See api/index.ts.
app.use("/api/v1", apiRouter);

// These two are always last: a request that matched no route becomes a 404,
// and anything thrown above lands in the error handler.
app.use(notFoundHandler);
app.use(errorHandler);
