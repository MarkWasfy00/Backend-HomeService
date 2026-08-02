# HomeServiceBackend

Express 5 + Prisma 7 + TypeScript, on PostgreSQL.

## Setup

```bash
npm install
cp .env.example .env      # then edit DATABASE_URL if needed
docker compose up -d      # start postgres (or point DATABASE_URL at your own)
npm run prisma:migrate    # create the schema + generate the client
```

## Run

```bash
npm run dev               # tsx watch, reloads on change
npm run typecheck         # run this before every commit
npm run build && npm start
```

## How the code is organised

Two ideas, and everything follows from them.

**1. Features are slices.** All the code for one feature lives in one folder
under `src/modules/`. To work on users you open `src/modules/users/` and stay
there. Nothing about users is scattered anywhere else.

**2. Routes are grouped by audience** — by *who each endpoint is for*.

| Prefix               | Audience         |
| -------------------- | ---------------- |
| `/api/v1/public`     | anyone           |
| `/api/v1/customer`   | customer-facing  |
| `/api/v1/technician` | technician-facing |
| `/api/v1/admin`      | back-office      |

**There is no authentication yet** — every endpoint is open, so you can call
anything from Postman with no token or header. JWT comes later.

The grouping still matters: when auth arrives it is one line per group in
`src/api/index.ts`, and **no route file changes**, because no route file checks
permissions itself.

```
src/
  index.ts                    starts the server, graceful shutdown
  app.ts                      express app: json, health, mounts /api/v1

  api/                        the URL map — which module answers which path
    index.ts                  ⭐ audience prefixes (auth guards go here later)
    public.ts  customer.ts  technician.ts  admin.ts

  modules/                    the features
    users/                    ⭐ the reference — copy this one
      users.schema.ts         zod: every shape the API accepts
      users.service.ts        all database access + rules
      users.mapper.ts         database row → JSON response
      users.state.ts          which onboarding screen comes next
      users.admin.routes.ts   endpoints for the admin audience
      users.customer.routes.ts   🔨 task 2
    auth/                     phone + OTP login
      auth.service.ts         codes, expiry, attempt limits
      auth.sms.ts             ⚠️ where a real SMS provider plugs in
    categories/               🔨 task 1 — scaffolded, bodies empty
    technicians/              🔨 tasks 3 & 5 — scaffolded, bodies empty
    uploads/                  🔨 task 4 — scaffolded, bodies empty

  core/                       shared plumbing, used by every module
    env.ts                    validated environment variables
    prisma.ts                 PrismaClient singleton
    fields.ts                 field rules shared by modules (phone, id)
    errors.ts                 ApiError
    error-handler.ts          turns any error into a JSON response
    pagination.ts             ?page= & ?limit= helpers
    serialize.ts              lets JSON.stringify handle BigInt ids

  generated/prisma/           generated client (gitignored, don't edit)
prisma/schema.prisma          data model
```

Inside a module each file has one job, and they call each other in one
direction only:

```
routes  →  service  →  database
   ↓
 mapper (shapes the response)
```

- **routes** — read the request, call a service, send a response. No SQL here.
- **service** — all Prisma queries and rules. No `req`/`res` here, which is
  what makes it reusable and easy to test.
- **schema** — validation. A route's first line is usually `schema.parse(...)`.
- **mapper** — decides which columns the outside world sees.

## Endpoints

No headers needed — just call them.

Three docs, three audiences:

| Doc | For | Contains |
| --- | --- | --- |
| [`docs/APP-FLOW.md`](docs/APP-FLOW.md) | the app team | every screen, the call it makes, what to do with the answer |
| [`docs/INTERN-TASKS.md`](docs/INTERN-TASKS.md) | whoever is writing endpoints | the 31 functions still to implement, with acceptance tests |
| [`docs/ONBOARDING-FLOW.md`](docs/ONBOARDING-FLOW.md) | anyone changing the design | why the flow works the way it does |

**Phone login** — how a user signs up and signs in.

| Method | Path                                | Description                              |
| ------ | ----------------------------------- | ---------------------------------------- |
| POST   | `/api/v1/public/auth/request-otp`   | `{ phone }` → sends a 6-digit code       |
| POST   | `/api/v1/public/auth/verify-otp`    | `{ phone, otpCode }` → the user + `accountState` |
| PATCH  | `/api/v1/public/onboarding/:id/role`| `{ role }` → customer or technician branch |

Both return an `accountState` telling the app which screen comes next:
`COMPLETE_PROFILE` (customer → profile page), `SUBMIT_DOCUMENTS` (technician →
national ID + criminal record form), `WAITING_FOR_APPROVAL`,
`VERIFICATION_REJECTED`, `READY`, `BLOCKED`, `SUSPENDED`.

The code is valid 5 minutes, single use; 60s between resends; 5 wrong guesses
locks the phone for 15 minutes. There's no SMS provider yet, so the code is
printed in the `npm run dev` terminal and returned as `devOtpCode` (never in
production).

**Users**

| Method | Path                            | Description                            |
| ------ | ------------------------------- | -------------------------------------- |
| GET    | `/api/v1/admin/users`           | List users (paginated + filters)       |
| GET    | `/api/v1/admin/users/:id`       | One user                               |
| POST   | `/api/v1/admin/users`           | Create a user                          |
| PATCH  | `/api/v1/admin/users/:id`       | Update name / phone / city / address / location |
| PATCH  | `/api/v1/admin/users/:id/status`| Activate / block / suspend             |
| DELETE | `/api/v1/admin/users/:id`       | Soft delete (204)                      |

`GET /admin/users` accepts `?page=` `?limit=` (max 100) `?role=` `?status=`
`?city=` and `?search=` (matches full name or phone).

Health checks sit outside the API: `GET /health` and `GET /health/db`.

### Responses

Success — a single object under `data`, lists add `meta`:

```jsonc
{ "data": { "id": "2", "fullName": "Mona Ali", "role": "CUSTOMER", ... } }

{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 } }
```

Errors — always the same shape, so the mobile app can handle them in one place:

```jsonc
{ "error": { "code": "validation_error", "message": "...", "details": [ ... ] } }
```

`400` invalid body/query · `404` missing · `409` duplicate phone · `500` bug.
(`401`/`403` arrive with auth.)

### Try it

```bash
curl -X POST localhost:3000/api/v1/admin/users \
  -H 'content-type: application/json' \
  -d '{"fullName":"Mona Ali","phone":"+201112223334","role":"CUSTOMER",
       "city":"Giza","address":"12 Nile St","latitude":30.0131,"longitude":31.2089}'

curl "localhost:3000/api/v1/admin/users?role=TECHNICIAN&page=1&limit=20"

curl localhost:3000/api/v1/admin/users/1

curl -X PATCH localhost:3000/api/v1/admin/users/1/status \
  -H 'content-type: application/json' -d '{"status":"ACTIVE"}'
```

## Authentication — not yet ⚠️

**Every endpoint is open.** There is no login, no token, no header. Build and
test features first; JWT comes after.

Two consequences while that is true:

- **Don't deploy this publicly.** Anyone could list or delete users.
- **The caller's id has to be passed in.** Where an endpoint will one day read
  "who am I" from a token, for now take it from the URL or the body — e.g. a
  service request carries a `customerId` field. Keep it a normal validated
  field; swapping it for the token later is a small edit.

When JWT lands it drops in at the group level in `src/api/index.ts`:

```ts
apiRouter.use("/admin", requireAuth, requireRole("ADMIN"), adminRouter);
```

Plus a `/api/v1/me` group for "my own account" endpoints, which can't exist
before then — it has no meaning without knowing the caller. No route, service,
schema or mapper file needs to change.

## Adding a new feature

Say you're adding categories:

1. `mkdir src/modules/categories`
2. Write `categories.schema.ts`, `categories.service.ts`, `categories.mapper.ts`.
3. Add a routes file per audience that needs it —
   `categories.admin.routes.ts` (manage), `categories.public.routes.ts` (browse).
4. Mount each one in its audience file: `adminRouter.use("/categories", ...)`
   in `src/api/admin.ts`.
5. `npm run typecheck`.

Copy the `users` module — it is the reference implementation.

## Things worth knowing

- **Ids are `BigInt`** and are sent as **strings** in JSON, because they don't
  fit in a JavaScript number. In code they're `bigint`, so write `1n` not `1`.
- **Users are soft-deleted.** `DELETE` sets `deleted_at`; the row stays. Every
  query must therefore filter `deletedAt: null` — the service does this with a
  shared `notDeleted` constant. Forgetting it leaks deleted users.
- **Never `try`/`catch` in a route.** Express 5 forwards rejected promises to
  the error handler, which already knows how to turn `ZodError`, `ApiError` and
  Prisma errors into the right status code. Just `throw`.
- **Money is `Decimal`**, never a float. Send it as a string.
- Prisma 7 connects through a **driver adapter** (`@prisma/adapter-pg`), set up
  in `src/core/prisma.ts`. The `datasource` block has no `url`; the connection
  string is read from `DATABASE_URL` at runtime.
- Prisma 7 doesn't load `.env` itself — `core/env.ts` and `prisma.config.ts` do
  it, and `core/env.ts` exits with a clear message if a variable is missing.
