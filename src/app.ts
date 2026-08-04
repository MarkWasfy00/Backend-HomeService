// Must be first: teaches JSON.stringify how to handle BigInt ids.
import "./core/serialize.js";

// Puts zod's own validation messages into Arabic. Global and side-effect only,
// so it has to be imported before the first request is parsed - here is the
// one place that is guaranteed.
import "./core/zod-arabic.js";

import express, { type Request, type Response } from "express";
import { apiRouter } from "./api/index.js";
import { docsRouter } from "./docs/docs.routes.js";
import { prisma } from "./core/prisma.js";
import { errorHandler, notFoundHandler } from "./core/error-handler.js";
import {
  uploadDir,
  uploadUrlPath,
} from "./modules/uploads/uploads.storage.js";

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

// Uploaded documents and photos, under the URLs the API hands back - a
// `profileImage` of "/uploads/1712-uuid.jpg" is fetched from right here.
//
// Anyone holding the URL can read the file: the random name in it is the only
// thing protecting a criminal record, which is why the technician mapper never
// returns that field to a non-admin. Put these behind a signed URL or a token
// check before this carries real identity documents.
//
// Two headers, because this serves bytes a stranger chose from the API's own
// origin. Multer can only believe the Content-Type the client declared, so a
// file saved as .jpg may hold anything at all:
//
//   nosniff      stops a browser second-guessing our Content-Type and running
//                an HTML payload that was uploaded as an image
//   attachment   only for PDFs - a PDF can carry JavaScript, and the built-in
//                viewer would run it on this origin. Images stay inline so the
//                app can still point an <img> at a profile photo.
app.use(
  uploadUrlPath,
  express.static(uploadDir, {
    setHeaders(res, filePath) {
      res.setHeader("X-Content-Type-Options", "nosniff");

      if (filePath.endsWith(".pdf")) {
        res.setHeader("Content-Disposition", "attachment");
      }
    },
  }),
);

// The API reference: Swagger UI at /docs, the OpenAPI document at
// /docs/openapi.json. Outside /api/v1 because it describes the API rather than
// being part of it. See docs/docs.routes.ts.
app.use("/docs", docsRouter);

// The entire API, grouped by audience. See api/index.ts.
app.use("/api/v1", apiRouter);

// These two are always last: a request that matched no route becomes a 404,
// and anything thrown above lands in the error handler.
app.use(notFoundHandler);
app.use(errorHandler);
