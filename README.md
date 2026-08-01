# HomeServiceBackend

Express 5 + Prisma 7 + TypeScript, on PostgreSQL.

## Setup

```bash
npm install
cp .env.example .env      # then edit DATABASE_URL if needed
```

Start a database (or point `DATABASE_URL` at your own):

```bash
docker compose up -d
```

Create the schema and generate the client:

```bash
npm run prisma:migrate    # prisma migrate dev
```

## Run

```bash
npm run dev               # tsx watch, reloads on change
npm run build && npm start
```

## Routes

| Method | Path         | Description                     |
| ------ | ------------ | ------------------------------- |
| GET    | `/health`    | Liveness, no DB required        |
| GET    | `/health/db` | Verifies the database is up     |
| GET    | `/users`     | List users                      |
| GET    | `/users/:id` | Fetch one user, 404 if missing  |
| POST   | `/users`     | Create a user (`email`, `name`) |
| DELETE | `/users/:id` | Delete a user                   |

```bash
curl localhost:3000/health
curl -X POST localhost:3000/users \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","name":"Ada"}'
```

## Layout

```
src/
  index.ts              server bootstrap, graceful shutdown
  app.ts                express app, middleware, error handlers
  prisma.ts             PrismaClient singleton + pg driver adapter
  routes/users.ts       example resource router
  generated/prisma/     generated client (gitignored)
prisma/schema.prisma    data model
prisma.config.ts        Prisma 7 CLI config
```

## Notes

- The `User` model in `prisma/schema.prisma` is a placeholder — replace it with
  your real domain models and run `npm run prisma:migrate` again.
- Prisma 7 connects through a **driver adapter** (`@prisma/adapter-pg`),
  configured in `src/prisma.ts`. The `datasource` block in the schema has no
  `url`; the connection string is read from `DATABASE_URL` at runtime.
- Prisma 7 does not load `.env` on its own — `import "dotenv/config"` in both
  `src/index.ts` and `prisma.config.ts` handles that.
- Express 5 auto-forwards rejected promises to the error handler, so async
  route handlers don't need `try`/`catch`.
