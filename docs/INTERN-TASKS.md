# What to build

87 items, 10 tasks — tasks 1, 2 and 3 are done, so 66 are left, in two halves.

**Tasks 1–5 get a user into the app**, and they are scaffolded: the files exist
and are already plugged into the API, each with a
`throw ApiError.notImplemented()` where your code goes and a `TODO` comment with
the details.

**Tasks 6–10 are the app itself** — ordering a service. Nothing there is
scaffolded; the spec in this file is the design, and creating the files is part
of the task.

| Task | What | Items | Who |
| ---- | ---- | ----- | --- |
| 1 | Categories | 13 | ✅ done |
| 2 | Customer profile | 3 | ✅ done |
| 3 | Technician profile | 5 | ✅ done |
| 4 | File upload | 3 | |
| 5 | Admin approval | 7 | |
| 6 | Points wallet | 16 | |
| 7 | Service request + past orders | 15 | |
| 8 | AI estimation | 6 | |
| 9 | Publish + technician feed | 14 | |
| 10 | Choosing a technician | 5 | |

Order: **4 → 5 → 6 → 7 → 8 → 9 → 10.** Tasks 1, 2 and 3 are finished; read them
as the worked examples — and note that task 5 touches the same files as task 3.
The second half is a chain: 8 spends what 6 built, 9 publishes what 7 created,
10 finishes what 9 started. Task 8 also needs task 4, because the AI needs a
photo to look at.

## Setup

```bash
npm install
cp .env.example .env      # set JWT_SECRET, any 32+ random characters
docker compose up -d
npm run prisma:migrate
npm run prisma:seed       # gives you the three test accounts below
npm run dev
```

### Getting a token

Every endpoint outside `/public` needs one. Two calls — the code is printed by
`npm run dev` and also comes back as `devOtpCode`:

```bash
API=localhost:3000/api/v1
PHONE=+201000000001      # the seeded admin; …02 customer, …03 technician

curl -X POST $API/public/auth/request-otp \
  -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\"}"

ADMIN_TOKEN=$(curl -s -X POST $API/public/auth/verify-otp \
  -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otpCode\":\"PASTE-THE-CODE\"}" \
  | jq -r .data.tokens.accessToken)
```

It lasts 15 minutes; after that you get `401` and either refresh
(`POST /public/auth/refresh`) or repeat the two calls above.

## Copy this

**`src/modules/users/`** is the finished example. Keep it open next to your work.

```
routes  →  service  →  database
   ↓
 mapper
```

| File | Job | Never has |
| ---- | --- | --------- |
| `*.schema.ts` | what the API accepts (zod) | logic |
| `*.service.ts` | Prisma queries | `req`, `res` |
| `*.mapper.ts` | row → JSON | queries |
| `*.routes.ts` | request in, response out | SQL |

## Rules

- No `try`/`catch` in routes. Just `throw ApiError.notFound("…")`.
- Never take a `userId` from the body or the URL. `currentUser(req).id` — the
  guards in `src/api/index.ts` already know who is calling.
- Let Prisma throw. Duplicate → 409, missing → 404, bad FK → 409. Don't pre-check.
- IDs are BigInt. Parse with `idParams`, return with `.toString()`.
- Money → string, never a float.
- Reading users? Filter `deletedAt: null`.
- Never hardcode an `accountState` — call `resolveAccountState()`.
- `npm run typecheck` must pass.

---

# Task 1 — Categories ✅ done

The list of fields (plumbing, electrical…) shown on screen 3, plus admin
management. Start here.

**`categories.schema.ts`**

- [x] `createCategoryBody` — `name` (2–100), `homeVisitBasePrice` (positive, 2dp)
- [x] `updateCategoryBody` — both optional, reject `{}`. Copy `updateUserBody`.

**`categories.service.ts`**

- [x] `listCategories()` — all, ordered by name. No pagination.
- [x] `getCategoryById(id)` — or `throw ApiError.notFound("Category not found")`
- [x] `createCategory(data)` — `name` is unique, duplicates 409 by themselves
- [x] `updateCategory(id, data)` — missing row 404s by itself
- [x] `deleteCategory(id)` — real delete. In use → 409, which is correct.

**`categories.mapper.ts`**

- [x] `toCategoryResponse(category)` — id as string, price as string

**`categories.public.routes.ts`**

- [x] `GET /` → `{ data: [...] }`, no `meta`

**`categories.admin.routes.ts`**

- [x] `GET /:id` → 200
- [x] `POST /` → 201
- [x] `PATCH /:id` → 200
- [x] `DELETE /:id` → 204, empty

The price is capped at `99999999.99` to match the `Decimal(10, 2)` column, so an
oversized price is a 400 rather than a 500. The Swagger bodies for these two
endpoints are generated from the zod schemas with `fromZod`, so the constraints
above only need changing in one place.

### Test it

```bash
curl -X POST localhost:3000/api/v1/admin/categories \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Plumbing","homeVisitBasePrice":150}'      # 201
curl localhost:3000/api/v1/public/categories             # 200, array (no token)
# repeat the POST                                        → 409
curl localhost:3000/api/v1/admin/categories/9999 \
  -H "Authorization: Bearer $ADMIN_TOKEN"                # 404
```

Price must come back as `"150.00"`. If you see `150`, fix the mapper.

---

# Task 2 — Customer profile ✅ done

Screen 5a. Fills in the blanks left after OTP and flips the user to `ACTIVE`.

> It does **not** create a user — that row already exists.

**`users.schema.ts`** (add to the existing file)

- [x] `createCustomerProfileBody` — just the exported `profileFields`
      (fullName, city, address, latitude, longitude). Reuse them, don't retype.
      No `userId`: it comes from the token.

**`users.service.ts`** (add to the existing file)

- [x] `completeCustomerProfile(userId, data)` — write the fields **and**
      `status: "ACTIVE"` in one update. Reuse `updateUserFields`. 409 if the
      user isn't `PENDING` — copy `selectRole`.

**`users.customer.routes.ts`**

- [x] `POST /` → 201 `{ data: { user, accountState, message } }`.
      State from `resolveAccountState(user, null)`, id from
      `currentUser(req).id` (`modules/auth/auth.middleware.js`).

### Test it

```bash
# TOKEN comes from verify-otp — see "Getting a token" at the top.
curl -X POST localhost:3000/api/v1/customer/profile \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"fullName":"Mona Ali","city":"Giza",
       "address":"12 Nile St","latitude":30.0131,"longitude":31.2089}'
```

201 with `"accountState":"READY"`. Same call again → 409. Log in again → `READY`.
No token → 401. A technician's token → 403.

---

# Task 3 — Technician profile ✅ done

Screen 5b. Personal details **and** documents in one form. Already written —
read it before starting task 2, it is the same job with a bigger payload.

**`technicians.schema.ts`**

- [x] `createTechnicianProfileBody` — `profileFields` (imported from
      `users.schema.ts`), `categoryId`, `nationalId` (the 14 digits as text —
      `nationalIdField` from `core/national-id.ts` checks them), optional
      `criminalRecordFile` and `profileImage`. No `userId` — the route passes
      `currentUser(req).id` to the service.

**`technicians.service.ts`**

- [x] `createTechnicianProfile(userId, data)` — **one `prisma.$transaction`**:
      1. `tx.user.update` — profile fields + `role: "TECHNICIAN"`
      2. `tx.technicianProfile.create` — `verificationStatus: "PENDING"`

      Leave `status` as `PENDING`. Return the user **and** the profile.
- [x] `findTechnicianProfileByUserId(userId)` — row or `null`

**`technicians.mapper.ts`**

- [x] `toTechnicianProfileResponse(profile)` — ids as strings, rating as string.
      **No `nationalId`, no `criminalRecordFile`** — admin-only, task 5.

**`technicians.technician.routes.ts`**

- [x] `POST /` → 201 with the profile + `accountState` + `message`

### Test it

```bash
curl -X PATCH localhost:3000/api/v1/me/role \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"role":"TECHNICIAN"}'

curl -X POST localhost:3000/api/v1/technician/profile \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"fullName":"Karim","city":"Cairo","address":"5 Tahrir",
       "latitude":30.0444,"longitude":31.2357,"categoryId":"1",
       "nationalId":"29805150101234"}'
```

201 with `WAITING_FOR_APPROVAL`. Log in again → still `WAITING_FOR_APPROVAL`,
never `COMPLETE_PROFILE`. Response must not contain `nationalId`.

---

# Task 4 — File upload

The app uploads each document, gets a URL, sends those URLs with task 3's form.

**Most of this is already done.** `POST /me/signup` needed to store files, so
multer is installed and the whole storage layer exists in
**`uploads.storage.ts`** — the configured instance, the jpeg/png/pdf filter, the
5 MB limit, the renaming, `publicUrlFor`, and `discardUploads`. `app.ts` already
serves the folder and `core/error-handler.ts` already turns a `MulterError`
into a 400.

What is left is the standalone endpoint, for clients that upload before they
submit a form rather than with it.

**`uploads.public.routes.ts`**

- [ ] `POST /` — `multipart/form-data`, field `file` → 201
      `{ data: { url: "/uploads/…" } }`

      Import `upload` and `publicUrlFor` from `./uploads.storage.js`; do **not**
      configure a second multer, or the two upload paths will drift apart. Add
      `upload.single("file")` as route middleware, then
      `res.status(201).json({ data: { url: publicUrlFor(req.file!) } })`.

- [ ] Decide what an empty request does. `upload.single` leaves `req.file`
      undefined when no file was sent, and that has to be a 400, not a crash.

**`src/api/public.ts`**

- [ ] Worth moving behind `requireAuth` while you are in there — see the note in
      that file. Everyone who uploads has a token by the time they do.

### Test it

```bash
curl -X POST localhost:3000/api/v1/public/uploads -F 'file=@photo.jpg'  # 201
curl localhost:3000/uploads/THE-RETURNED-NAME                           # the file
curl -X POST localhost:3000/api/v1/public/uploads -F 'file=@big.zip'    # 400
curl -X POST localhost:3000/api/v1/public/uploads                       # 400, no file
```

---

# Task 5 — Admin approval

Until an admin does this, every technician sits on the waiting screen.

**`technicians.schema.ts`**

- [ ] `updateVerificationBody` — `VERIFIED` or `REJECTED` only (not `PENDING`)
- [ ] `listTechniciansQuery` — add an optional `verificationStatus` filter.
      Copy `listUsersQuery`.

**`technicians.service.ts`**

- [ ] `listTechnicians(query)` — one page + total, `include: { user, category }`.
      Copy `listUsers`.
- [ ] `setVerificationStatus(profileId, data)` — **one `prisma.$transaction`**:
      - `VERIFIED` → profile VERIFIED **and** `user.status = "ACTIVE"`.
        Both, or the technician is stuck waiting forever.
      - `REJECTED` → profile REJECTED, user stays `PENDING` so they can resubmit.

**`technicians.mapper.ts`**

- [ ] `toTechnicianProfileAdminResponse(profile)` — the same fields **plus**
      `nationalId` and `criminalRecordFile`. Two functions, not one with a flag.

**`technicians.admin.routes.ts`**

- [ ] `GET /` → `{ data, meta }`
- [ ] `PATCH /:id/verification` → 200

### Test it

```bash
curl "localhost:3000/api/v1/admin/technicians?verificationStatus=PENDING" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X PATCH localhost:3000/api/v1/admin/technicians/1/verification \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"verificationStatus":"VERIFIED"}'
```

That technician logs in again → `READY`. Sending `"PENDING"` → 400.

---

# Ordering a service — tasks 6 to 10

Everything above gets a user *into* the app. This half is what they came for:
the customer describes a problem, optionally pays points to have an AI size it,
broadcasts it to the technicians in that field, and picks one of the ones who
answered.

**None of it is scaffolded.** Unlike tasks 1–5 there are no files waiting with a
`notImplemented` in them — the design below is the spec, and creating the files
is part of the task. Keep copying `src/modules/users/`.

## The flow

```
 Profile screen
   ├── points balance          GET  /customer/points              task 6
   ├── past orders             GET  /customer/requests            task 7
   └── "tell us your problem"
         │
         ▼
   Pick a field                GET  /public/categories            done (task 1)
         │
         ▼
   ┌─────────────────────────────────────────┐
   │  Describe it              POST /customer/requests            task 7
   │  title + photos + category → a DRAFT request (status PENDING)│
   └───────────────┬─────────────────────────┘
                   │
        ┌──────────┴───────────┐
        ▼                      ▼
  "Describe it with AI"   "Just send a technician"
  POST …/ai-estimation    (requestType HOME_VISIT — no AI, no charge)
  costs 50 points                    │
  → severity + price range   task 8  │
        │                            │
        └──────────┬─────────────────┘
                   ▼  the "Continue" button
   Publish                    POST /customer/requests/:id/publish  task 9
   → status WAITING_FOR_TECHNICIAN
   → one PENDING offer per nearby technician in that category
                   │
                   ▼
   Technician home page       GET  /technician/offers              task 9
   → problem, photos, AI price range, customer's first name + distance
   → POST /technician/offers/:id/accept          (or /decline)
   → the 5th acceptance closes the rest: they vanish from every other feed
                   │
                   ▼
   Customer picks             GET  /customer/requests/:id/offers   task 10
   → the technicians who accepted, nearest first, with rating + skills
   → POST /customer/requests/:id/offers/:offerId/select
   → request TECHNICIAN_SELECTED, that technician assigned, the rest closed
```

Four rules hold this together, and every task below leans on one of them:

1. **A request is a draft until it is published.** `RequestStatus.PENDING` means
   "the customer is still filling this in"; `WAITING_FOR_TECHNICIAN` means it is
   out there. Nothing fans out to technicians until `publish`.
2. **The AI does not price anything.** It returns a `Severity` and a confidence.
   The price range is read out of `category_pricing`, which
   `prisma/seed-categories.ts` already fills for every (category, severity)
   pair. A price the AI invented could not be audited or corrected; a severity
   can.
3. **Points are spent inside the same transaction that writes what they bought.**
   Never charge, then call something, then write. If the write fails the charge
   rolls back with it.
4. **Money and identity are revealed late.** A technician sees a first name, a
   city and a distance. The phone number and the exact address appear only once
   the customer has selected them.

New constants — each one named, in one place, never typed inline:

| Constant | Value | Where |
| -------- | ----- | ----- |
| `AI_ESTIMATION_POINTS_COST` | 50 | `core/env.ts` |
| `FANOUT_RADIUS_KM` | 25 | `modules/offers/offers.service.ts` |
| `FANOUT_MAX_TECHNICIANS` | 50 | same |
| `MAX_ACCEPTED_OFFERS` | 5 | same |

---

# Task 6 — Points wallet

The number on the profile screen, and the thing an AI estimation spends. Top-up
with a card is **not** in this task — see *Recharging* at the end of it.

**`prisma/schema.prisma`**

- [ ] `User.pointsBalance` — `Int @default(0) @map("points_balance")`
- [ ] `PointsTransaction` + a `PointsTransactionType` enum:

      ```prisma
      enum PointsTransactionType {
        TOPUP        // bought with money — task for later
        SPEND        // an AI estimation
        REFUND       // we failed, give it back
        ADMIN_GRANT  // support, and how you test this today
      }

      model PointsTransaction {
        id               BigInt   @id @default(autoincrement())
        userId           BigInt   @map("user_id")
        type             PointsTransactionType
        amount           Int      // signed: +100 top-up, -50 spend
        balanceAfter     Int      @map("balance_after")
        reason           String?  @db.VarChar(255)
        serviceRequestId BigInt?  @map("service_request_id")
        createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

        user User @relation(fields: [userId], references: [id], onDelete: Cascade)

        @@index([userId, createdAt])
        @@map("points_transactions")
      }
      ```

      Both a column **and** a ledger, on purpose. The column is what every read
      needs and what the conditional decrement below locks on; the ledger is
      what answers "where did my 50 points go" and is the row a payment webhook
      will one day write. A balance with no history is unauditable; a history
      with no balance costs a `SUM` on every request.

- [ ] `npm run prisma:migrate -- --name points_wallet`

**`src/core/errors.ts`** and **`src/core/messages.ts`**

- [ ] `ApiError.paymentRequired()` → `402 insufficient_points`, and
      `ApiError.serviceUnavailable()` → `503 service_unavailable` (task 8 needs
      the second one). Add a `messages.points` block —
      `notEnough: "رصيد نقاطك مش كفاية. اشحن نقاط وحاول تاني."` — and the new
      field labels (`points`, `amount`, `title`, `description`, `images`).

**`src/modules/points/points.schema.ts`**

- [ ] `listPointsQuery` — `paginationQuery` plus an optional `type` filter
- [ ] `grantPointsBody` — `amount` (int, 1…100000), `reason` (optional, ≤255).
      Admin only. No `userId` — it is the `:id` in the URL.

**`src/modules/points/points.service.ts`**

```ts
getPointsBalance(userId: bigint): Promise<number>
listPointsTransactions(userId: bigint, query: ListPointsQuery): Promise<{ transactions: PointsTransaction[]; total: number }>
spendPoints(tx: Prisma.TransactionClient, userId: bigint, amount: number, meta: { reason?: string; serviceRequestId?: bigint }): Promise<number>
creditPoints(tx: Prisma.TransactionClient, userId: bigint, amount: number, meta: { type: PointsTransactionType; reason?: string }): Promise<number>
```

- [ ] `getPointsBalance` — one `select: { pointsBalance: true }`, 404 if the user
      is gone or soft-deleted.
- [ ] `listPointsTransactions` — a page + a total, newest first. Copy `listUsers`.
- [ ] `spendPoints` — **takes a transaction client, never `prisma` directly.** It
      is always part of a bigger write. The guard is one conditional update, not
      a read-then-write:

      ```ts
      const { count } = await tx.user.updateMany({
        where: { id: userId, deletedAt: null, pointsBalance: { gte: amount } },
        data: { pointsBalance: { decrement: amount } },
      });
      if (count === 0) throw ApiError.paymentRequired(messages.points.notEnough);
      ```

      That is the whole race-condition story: two estimations fired at once
      cannot both pass, because the second `updateMany` matches zero rows. A
      `findUnique` followed by an `if` would let both through. Then insert the
      `SPEND` row with the returned `balanceAfter` and return the new balance.
- [ ] `creditPoints` — the mirror image, `increment`, positive `amount`.

**`src/modules/points/points.mapper.ts`**

- [ ] `toPointsTransactionResponse(row)` — ids as strings, `amount` and
      `balanceAfter` as plain ints (points are whole numbers, not money — this
      is the one place the "money is a string" rule does not apply, and say so
      in a comment).

**`src/modules/users/users.mapper.ts`**

- [ ] Add `pointsBalance` to `toUserResponse`, so the profile screen gets it
      from `GET /me` without a second call.

**`src/modules/points/points.customer.routes.ts`**

- [ ] `GET /` → `{ data: { pointsBalance: 250 } }`
- [ ] `GET /transactions` → `{ data: [...], meta }`

**`src/modules/points/points.admin.routes.ts`**

- [ ] `POST /:id/points` → 201, grants points to any user. `ADMIN_GRANT`. This
      is how you get points to test task 8 with before payments exist.

**Wiring**

- [ ] `customerRouter.use("/points", pointsCustomerRoutes)` in `src/api/customer.ts`
      and `adminRouter.use("/users", pointsAdminRoutes)` in `src/api/admin.ts`
      (mounted next to `adminUsersRoutes` — same prefix, different file).

### Recharging — what we will use

Not this task, but decide it before designing the top-up screen, because it
shapes the model above.

**Use Paymob.** It is the Egyptian default and the only one of these that covers
every way an Egyptian customer actually pays in one integration: Visa/Mastercard,
Meeza, Vodafone Cash and the other wallets, Fawry reference codes, and ValU
instalments. Settlement is in EGP against an Egyptian merchant account. The
alternatives, briefly: **Fawry** has the best cash coverage but a weaker card
flow, **Kashier** and **Geidea** are fine and slightly simpler, and
**Stripe/PayPal cannot acquire locally in EGP at all** — do not design around
them.

Three rules for whoever builds it:

- **The webhook is what credits the wallet, not the app.** Paymob's callback to
  the client can be replayed, dropped or forged. The server-to-server webhook is
  HMAC-signed; verify it, then `creditPoints(..., { type: "TOPUP" })`.
- **The packages live on the server.** `POST /customer/points/topup { packageId }`,
  never `{ amount }`. A client that names its own price will eventually name 0.
- **Idempotency comes from the provider's reference.** Add
  `providerRef String? @unique` to `PointsTransaction` when you get there; a
  webhook that arrives twice then fails on the unique index instead of doubling
  someone's balance.

One thing to check early: Apple and Google require in-app purchase for *digital*
goods only. Points that buy a real technician who comes to your flat are a
real-world service and are exempt — but the review teams argue about it, so
confirm before the first store submission.

### Test it

```bash
curl -X POST localhost:3000/api/v1/admin/users/2/points \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"amount":100,"reason":"testing"}'                       # 201

curl localhost:3000/api/v1/customer/points -H "Authorization: Bearer $TOKEN"
# { "data": { "pointsBalance": 100 } }
curl localhost:3000/api/v1/customer/points/transactions -H "Authorization: Bearer $TOKEN"
```

---

# Task 7 — The customer's problem, and their past orders

Two screens: the list of everything they have ordered before, and the form that
starts a new one. The form only creates a **draft** — nothing reaches a
technician until task 9 publishes it.

**`prisma/schema.prisma`**

- [ ] `ServiceRequest.title` — `String @db.VarChar(120)`. The AI takes a title
      and a photo, and the past-orders list needs one line to show; `description`
      is the paragraph underneath. Migrate.

**`src/modules/requests/requests.schema.ts`**

- [ ] `createServiceRequestBody` — `title` (3–120), `description` (10–2000),
      `categoryId` (`idField`), `requestType` (`AI_ESTIMATION` | `HOME_VISIT`),
      `images` (array of URL strings from `POST /public/uploads`, 0–5 — required
      when `requestType` is `AI_ESTIMATION`, because that is what the AI looks
      at), and an optional address override (`serviceAddress`, `serviceCity`,
      `latitude`, `longitude`).
- [ ] `listMyRequestsQuery` — `paginationQuery` plus an optional `status`.
- [ ] `requestIdParams` = `idParams`; `requestOfferParams` for
      `/:id/offers/:offerId` (task 10).

**`src/modules/requests/requests.service.ts`**

```ts
createServiceRequest(customerId: bigint, data: CreateServiceRequestBody)
listCustomerRequests(customerId: bigint, query: ListMyRequestsQuery)
getCustomerRequest(customerId: bigint, requestId: bigint)
cancelServiceRequest(customerId: bigint, requestId: bigint)
```

- [ ] `createServiceRequest` — one `prisma.$transaction`: create the request with
      `status: "PENDING"`, then `tx.requestAttachment.createMany` for the images.
      **The address is a snapshot, not a join.** Default it from the user's
      profile, but copy the values onto the request — the customer may move house
      next year and the job happened where it happened. A bad `categoryId` is a
      P2003 → 409 on its own; do not pre-check it.
- [ ] `listCustomerRequests` — the past-orders screen. A page + a total, newest
      first, `where: { customerId }`, `include: { category: true, technician: true,
      aiEstimation: true }`. Always scope by `customerId` in the `where` — never
      fetch and then compare in JS.
- [ ] `getCustomerRequest` — `findFirst({ where: { id, customerId } })`, plus
      attachments, estimation, category, technician and `_count: { select: { offers: true } }`.
      Not theirs → **404, not 403.** A 403 tells a stranger the request exists.
- [ ] `cancelServiceRequest` — allowed from `PENDING`, `WAITING_FOR_TECHNICIAN`
      and `TECHNICIAN_SELECTED`; anything else is a 409. One transaction: the
      request to `CANCELLED`, and every offer still `PENDING` or `ACCEPTED` to
      `NOT_SELECTED`, so it drops out of the technicians' feeds too.

**`src/modules/requests/requests.mapper.ts`**

- [ ] `toServiceRequestResponse(request)` — the customer's own view. Ids as
      strings, `visitFee`/`distanceKm` as strings or null, attachments as an
      array of urls, `aiEstimation` nested or null. Include the assigned
      technician's **phone** here — but only when `status` is past
      `TECHNICIAN_SELECTED`, because that is the point at which the two of them
      are supposed to talk.
- [ ] `toServiceRequestListItem(request)` — the past-orders row: id, title,
      category name, status, createdAt, visitFee, technician name. Deliberately
      smaller than the one above; a list of 20 does not need 20 sets of
      attachments.

**`src/modules/requests/requests.customer.routes.ts`**

- [ ] `POST /` → 201
- [ ] `GET /` → `{ data, meta }`
- [ ] `GET /:id` → 200
- [ ] `POST /:id/cancel` → 200

**Wiring**

- [ ] `customerRouter.use("/requests", requestsCustomerRoutes)` — the line
      `src/api/customer.ts` already predicts in its comment.

### Test it

```bash
curl -X POST localhost:3000/api/v1/customer/requests \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Kitchen sink leaking","description":"Water under the sink since yesterday, the pipe joint is wet.","categoryId":"1","requestType":"AI_ESTIMATION","images":["/uploads/1712-sink.jpg"]}'
# 201, "status":"PENDING"

curl localhost:3000/api/v1/customer/requests -H "Authorization: Bearer $TOKEN"
curl localhost:3000/api/v1/customer/requests/1 -H "Authorization: Bearer $OTHER_TOKEN"  # 404
```

---

# Task 8 — "Describe it with an AI"

Title + photo in, severity + price range out, 50 points off the balance. The
model itself is somebody else's job — this task is the endpoint, the charge, and
the contract with them.

**`src/core/env.ts`**

- [ ] `AI_SERVICE_URL` (optional), `AI_SERVICE_TOKEN` (optional),
      `AI_TIMEOUT_MS` (default 15000), `AI_ESTIMATION_POINTS_COST` (default 50).

**`src/modules/ai/ai.client.ts`** — the whole integration, in one file, exactly
like `auth.sms.ts` is the only file that knows what an SMS is.

```ts
type AiEstimateInput = { title: string; description: string; categoryName: string; imageUrls: string[] };
type AiEstimateResult = { severity: Severity; confidence: number };

estimateProblem(input: AiEstimateInput): Promise<AiEstimateResult>
```

- [ ] `estimateProblem` — `POST {AI_SERVICE_URL}/estimate` with a bearer token
      and `AbortSignal.timeout(AI_TIMEOUT_MS)`. **Parse the response with zod**
      before returning it: this is somebody else's service and a `severity` of
      `"medium"` or `"HUGE"` must be our 503, not a Prisma enum crash. Any
      failure — timeout, non-200, unparseable body — becomes
      `ApiError.serviceUnavailable(messages.ai.unavailable)`. Never a 500, and
      never a charge.
- [ ] With no `AI_SERVICE_URL` configured, return a **deterministic stub**
      (hash the title → a severity, confidence `0.5`) and log it, the same way
      `sendOtpSms` prints the code. In production, an unconfigured URL throws at
      startup instead. Without this nobody can test tasks 9 and 10 until the AI
      exists.

The contract to hand the AI engineer:

```jsonc
// POST /estimate
{ "category": "Plumbing",
  "title": "Kitchen sink leaking",
  "description": "Water under the sink since yesterday…",
  "images": ["https://api.example.com/uploads/1712-sink.jpg"] }

// 200
{ "severity": "MEDIUM", "confidence": 0.82 }   // SMALL | MEDIUM | LARGE, 0…1
```

> **Decide before wiring a real model:** those image URLs have to be reachable
> *from the AI service*. Today files are on the app container's local disk and
> the stored url is a path (`/uploads/…`), so a remote model cannot fetch it.
> Either add a `PUBLIC_BASE_URL` and make the folder publicly readable, or POST
> the bytes. This is the same limitation as the "one node only" note in
> `ONBOARDING-FLOW.md`, and S3 fixes both at once.

**`src/modules/requests/requests.service.ts`** (add to task 7's file)

```ts
estimateServiceRequest(customerId: bigint, requestId: bigint)
```

- [ ] The order of operations is the whole task:

      1. Load the request with its category and attachments, scoped by
         `customerId`. Missing → 404.
      2. `requestType !== "AI_ESTIMATION"` or `status !== "PENDING"` → 409.
      3. **Already has an `aiEstimation` → return it and charge nothing.** Not a
         409: a customer whose app retried a timed-out request must not pay
         twice. `AiEstimation.serviceRequestId` is unique, so the database
         agrees with you.
      4. Cheap balance check → 402 before calling the AI. Do not spend somebody
         else's GPU on a customer who cannot pay for it. This is a courtesy
         check, not the guard.
      5. `await estimateProblem(...)` — **outside any transaction.** A 15-second
         HTTP call inside `$transaction` holds a Postgres connection open for 15
         seconds; do that a hundred times at once and the pool is gone.
      6. One `prisma.$transaction`:
         - `spendPoints(tx, customerId, AI_ESTIMATION_POINTS_COST, { serviceRequestId })`
           — the real guard, and a 402 here means a concurrent estimation won.
         - `tx.categoryPricing.findUnique({ where: { categoryId_severity: … } })`
           for the min/max. Missing row → `ApiError.conflict(messages.requests.pricingMissing)`
           and tell them to run `prisma/seed-categories.ts`; the bands are
           seeded for every category, so a gap is a deployment fault, not a user
           error.
         - `tx.aiEstimation.create({ … })`.

         All three or none: if the pricing lookup fails, the 50 points are never
         taken, because the transaction rolls back the decrement with it.

**`src/modules/requests/requests.mapper.ts`**

- [ ] `toAiEstimationResponse(estimation)` — `severity`, `minPrice`/`maxPrice` as
      2dp strings, `confidence` as a string. Prices are money: strings, never
      floats.

**`src/modules/requests/requests.customer.routes.ts`**

- [ ] `POST /:id/ai-estimation` → 201

      ```jsonc
      { "data": { "estimation": { "severity": "MEDIUM", "minPrice": "375.00",
                                  "maxPrice": "900.00", "confidence": "0.82" },
                  "pointsCharged": 50, "pointsBalance": 50 } }
      ```

      Return the new balance in the same response. The screen that shows the
      estimate also shows the wallet, and it should not need a second call to
      find out what the first one cost.

### Test it

```bash
curl -X POST localhost:3000/api/v1/customer/requests/1/ai-estimation \
  -H "Authorization: Bearer $TOKEN"          # 201, balance drops by 50
curl -X POST localhost:3000/api/v1/customer/requests/1/ai-estimation \
  -H "Authorization: Bearer $TOKEN"          # 201, same estimate, balance unchanged
# spend the rest of the points, then on a fresh request:  402 insufficient_points
```

---

# Task 9 — Publishing, and the technician's home page

The "Continue" button. The request goes out to every nearby technician in that
category, and their home screen fills up with it.

**`src/modules/requests/requests.service.ts`**

```ts
publishServiceRequest(customerId: bigint, requestId: bigint)
```

- [ ] Guards: owned by the caller, `status === "PENDING"`, and — when
      `requestType` is `AI_ESTIMATION` — an `aiEstimation` row exists. Publishing
      an AI request with no estimate would send technicians a card with an empty
      price on it. `HOME_VISIT` skips that check: it is the "just send someone"
      option and its price is the category's `homeVisitBasePrice`.
- [ ] One transaction: set `status: "WAITING_FOR_TECHNICIAN"`, then
      `fanOutOffers(tx, request)` below. Return the request and how many
      technicians it reached.
- [ ] **Zero technicians nearby is not an error.** Publish anyway and return
      `technicianCount: 0`, so the app can say "nobody in your area yet" instead
      of a 409 the customer cannot act on.

**`src/core/geo.ts`** (new)

```ts
distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number
boundingBox(center: { lat: number; lng: number }, radiusKm: number): { minLat: number; maxLat: number; minLng: number; maxLng: number }
```

- [ ] Haversine, and the box that prefilters it. The box is a `where` Postgres
      can serve from an index; the haversine then trims the corners in JS. Doing
      it the other way round means reading every technician in the country.

**`src/modules/offers/offers.service.ts`**

```ts
fanOutOffers(tx: Prisma.TransactionClient, request: ServiceRequest): Promise<number>
listTechnicianOffers(technicianId: bigint, query: ListOffersQuery)
acceptOffer(technicianId: bigint, offerId: bigint)
declineOffer(technicianId: bigint, offerId: bigint)
```

- [ ] `fanOutOffers` — find the eligible technicians and `createMany` one
      `PENDING` offer each, `skipDuplicates: true`. Eligible means **all** of:
      `TechnicianProfile.categoryId === request.categoryId`,
      `verificationStatus: "VERIFIED"`, `isAvailable: true`,
      `user.status: "ACTIVE"`, `user.deletedAt: null`, inside
      `FANOUT_RADIUS_KM` — nearest `FANOUT_MAX_TECHNICIANS` if more qualify.

      > Why rows rather than a live query: `@@unique([serviceRequestId,
      > technicianId])` and `OfferStatus.PENDING` already exist for this, a
      > declined offer needs a row to stay hidden anyway, and "it disappeared
      > from the other technicians' screens" becomes one `updateMany` instead of
      > a filter every reader has to remember. It also gives push notifications
      > something to hang on later. The cost is one `createMany` of at most 50
      > rows per publish.

- [ ] `listTechnicianOffers` — the home page. `where: { technicianId, status:
      query.status ?? "PENDING", serviceRequest: { status: "WAITING_FOR_TECHNICIAN" } }`,
      `include` the request with its category, attachments, `aiEstimation` and
      customer. Paginated, newest first. The second condition is belt and
      braces — a cancelled request should never render even if its offers were
      missed.
- [ ] `acceptOffer` — one transaction, and every guard is a conditional write,
      not a read:
      - `updateMany({ where: { id: offerId, technicianId, status: "PENDING",
        serviceRequest: { status: "WAITING_FOR_TECHNICIAN" } }, data: { status:
        "ACCEPTED", acceptedAt: new Date() } })`. `count === 0` → 409
        `messages.offers.noLongerAvailable`, which covers all of: not mine,
        already answered, request cancelled, technician already chosen.
      - Then count the `ACCEPTED` offers on that request. Over
        `MAX_ACCEPTED_OFFERS` → roll back with a 409
        `messages.offers.enoughTechnicians`. Exactly at it → close the rest:
        `updateMany({ where: { serviceRequestId, status: "PENDING" }, data: {
        status: "NOT_SELECTED" } })`. That is the "it vanishes from the other
        screens" line in the brief, and it fires here rather than at selection
        so five people are not left waiting on one customer's decision.
- [ ] `declineOffer` — `PENDING` → `DECLINED`, same conditional-update shape.
      Nothing else changes; it only hides the card.

**`src/modules/offers/offers.mapper.ts`**

- [ ] `toTechnicianOfferResponse(offer, distanceKm)` — the card on the
      technician's home page: offer id and status, the problem (title,
      description, photos, category name), the AI's severity and price range or
      the category's `homeVisitBasePrice` for a `HOME_VISIT`, and of the
      customer **only** `fullName`, `serviceCity` and `distanceKm`.

      **No phone. No `serviceAddress`. No exact coordinates.** Fifty technicians
      receive this card and at most one gets the job; the other forty-nine have
      no reason to hold a stranger's address. Task 10 adds a second mapper for
      after the choice is made.

**`src/modules/offers/offers.technician.routes.ts`**

- [ ] `GET /` → `{ data, meta }`
- [ ] `POST /:id/accept` → 200
- [ ] `POST /:id/decline` → 200

**`src/modules/requests/requests.customer.routes.ts`**

- [ ] `POST /:id/publish` → 200 `{ data: { request, technicianCount: 7 } }`

**Wiring**

- [ ] `technicianRouter.use("/offers", offersTechnicianRoutes)` — again, the
      line `src/api/technician.ts` already predicts.

### Test it

```bash
curl -X POST localhost:3000/api/v1/customer/requests/1/publish \
  -H "Authorization: Bearer $TOKEN"                       # 200, technicianCount

curl localhost:3000/api/v1/technician/offers -H "Authorization: Bearer $TECH_TOKEN"
curl -X POST localhost:3000/api/v1/technician/offers/3/accept \
  -H "Authorization: Bearer $TECH_TOKEN"                  # 200
curl -X POST localhost:3000/api/v1/technician/offers/3/accept \
  -H "Authorization: Bearer $TECH_TOKEN"                  # 409, already answered
```

Accept with five different technicians, then check the sixth: their offer is
`NOT_SELECTED` and gone from `GET /technician/offers`.

---

# Task 10 — Choosing a technician

The customer's list of everyone who accepted, nearest first, and the tap that
assigns one of them.

**`src/modules/offers/offers.service.ts`**

```ts
listRequestOffers(customerId: bigint, requestId: bigint)
selectOffer(customerId: bigint, requestId: bigint, offerId: bigint)
```

- [ ] `listRequestOffers` — the accepted offers on that request, with the
      technician's `User` and `TechnicianProfile` and the profile's `Category`.
      **Not paginated** — `MAX_ACCEPTED_OFFERS` is 5. Compute `distanceKm` for
      each from the request's stored coordinates and sort ascending, then by
      `overallRating` descending as the tie-break. Sorting in JS is right here
      and wrong in task 9: five rows, versus every technician in the governorate.
- [ ] `selectOffer` — one transaction, in this order:

      1. `tx.serviceRequest.updateMany({ where: { id: requestId, customerId,
         status: "WAITING_FOR_TECHNICIAN", technicianId: null }, data: {
         technicianId, status: "TECHNICIAN_SELECTED", visitFee, distanceKm } })`.
         `count === 0` → 409 `messages.offers.alreadyAssigned`. Putting the
         request first makes it the lock: two taps on a slow connection cannot
         both assign, because the second no longer matches `technicianId: null`.
      2. The chosen offer `ACCEPTED` → `SELECTED`, conditionally. `count === 0`
         means it was never accepted → 409 `messages.offers.notAccepted`.
      3. Every other offer on the request → `NOT_SELECTED`.

      `visitFee` is the category's `homeVisitBasePrice` at the moment of
      selection — copied onto the request, not read through the join later, for
      the same reason the address is a snapshot: the admin will change that
      price and last month's job must not change with it.

**`src/modules/offers/offers.mapper.ts`**

- [ ] `toOfferTechnicianResponse(offer, distanceKm)` — the card the customer
      chooses from: technician `fullName`, `profileImage`, `overallRating`,
      `totalReviews`, their category name, `city`, `distanceKm` (2dp string),
      `acceptedAt`. Still no phone — it appears in
      `toServiceRequestResponse` after the selection, which is task 7's mapper
      and the one place that decides it.

**`src/modules/requests/requests.customer.routes.ts`**

- [ ] `GET /:id/offers` → `{ data: [...] }`, no `meta`
- [ ] `POST /:id/offers/:offerId/select` → 200 `{ data: { request } }`, the
      request now carrying the assigned technician.

### Test it

```bash
curl localhost:3000/api/v1/customer/requests/1/offers -H "Authorization: Bearer $TOKEN"
# 200, accepted technicians only, distanceKm ascending

curl -X POST localhost:3000/api/v1/customer/requests/1/offers/3/select \
  -H "Authorization: Bearer $TOKEN"     # 200, status TECHNICIAN_SELECTED
curl -X POST localhost:3000/api/v1/customer/requests/1/offers/4/select \
  -H "Authorization: Bearer $TOKEN"     # 409, already assigned
```

The four technicians who were not chosen: their offer is `NOT_SELECTED` and no
longer in `GET /technician/offers`. The chosen one sees the job — and now the
customer's phone number.

---

## Done means

1. `npm run typecheck` exits 0
2. Every curl above does what it says
3. No `notImplemented` left in your files
4. Every new zod schema is registered in `src/docs/openapi.ts` with `fromZod`,
   so `/docs` documents what the routes actually accept

## Later, not now

The job itself — `ON_THE_WAY` → `ARRIVED` → `IN_PROGRESS` → `COMPLETED`, and the
two review tables that hang off a completed one · paying for the visit ·
topping up points with a card (task 6, *Recharging*) · push notifications, which
is what the offer rows are waiting for · a real SMS provider · per-device token
revocation.
