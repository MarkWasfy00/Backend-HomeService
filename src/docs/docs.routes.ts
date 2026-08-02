import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi.js";

/**
 * The browsable API reference, mounted at `/docs` in src/app.ts.
 *
 *   GET /docs               Swagger UI - read the endpoints, and call them
 *   GET /docs/openapi.json  the raw OpenAPI 3.1 document
 *
 * The JSON route is the useful half for tooling: point Postman, Insomnia or a
 * client generator at it and the whole API arrives without anyone writing a
 * request by hand.
 *
 * Swagger UI is served from `swagger-ui-dist` inside node_modules rather than a
 * CDN, so the page works with no internet - which matters, because the API it
 * documents is usually running on localhost.
 *
 * Like `/health`, this sits outside `/api/v1`: it describes every version of
 * the API rather than belonging to one, and it needs no token. Nothing secret
 * is exposed - it is the same route map as README.md, only clickable. If this
 * ever runs on a public host and that is not wanted, mount it behind a guard
 * here, or skip mounting it in app.ts when `isProduction`.
 */
export const docsRouter = Router();

/** The document itself. Fetched by the page below, and by any API client. */
docsRouter.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

docsRouter.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "HomeService API",
    swaggerOptions: {
      // Keeps the token from "Authorize" across reloads, so testing a flow does
      // not mean pasting it again after every change.
      persistAuthorization: true,
      // Endpoints collapsed, tags open: the whole API fits on one screen.
      docExpansion: "list",
      displayRequestDuration: true,
      // No `tagsSorter`/`operationsSorter` on purpose - without them Swagger UI
      // keeps the order the document declares, which is the order a user meets
      // the endpoints in: log in, onboard, then the back-office.
    },
  }),
);
