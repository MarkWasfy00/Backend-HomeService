# Onboarding flow — design + open tasks

How a user gets from "opened the app" to "can use the app", which endpoint
serves each screen, and which ones are still to be built.

## The screens, and what each one calls

| # | Screen                        | Endpoint                              | Status |
| - | ----------------------------- | ------------------------------------- | ------ |
| 1 | Enter phone                   | `POST /api/v1/public/auth/request-otp` | ✅ done |
| 2 | Enter the 6-digit code        | `POST /api/v1/public/auth/verify-otp`  | ✅ done |
| 3 | Pick a field (plumbing, …)    | `GET /api/v1/public/categories`        | 🔨 task 1 |
| 4 | "Customer or technician?"     | `PATCH /api/v1/me/role`                | ✅ done |
| 5a| Customer → profile page       | `POST /api/v1/customer/profile`        | ✅ done |
| 5b| Technician → documents form   | `POST /api/v1/technician/profile`      | ✅ done |
|   | ↳ the file upload itself      | `POST /api/v1/public/uploads`          | 🔨 task 4 |
|   | Admin approves the technician | `PATCH /api/v1/admin/technicians/:id/verification` | 🔨 task 5 |

Every 🔨 endpoint **already exists in the route map** — the files are written,
the functions are named, the bodies are empty. Calling one today returns:

```json
{ "error": { "code": "not_implemented", "message": "This endpoint is not built yet" } }
```

with status `501`. Your job is to delete the `throw ApiError.notImplemented()`
and write the body. Follow the `TODO(task N)` comments — each one names the
Prisma call and the traps.

## Three decisions that keep this simple

Everything from step 4 on runs behind a token. `verify-otp` issues one to a
PENDING user precisely so the rest of onboarding can be authenticated: each of
those steps acts on *the caller*, so none of them takes a `userId` — the id
comes from the token via `currentUser(req)`. See the Authentication section of
the README.

**1. The user row is created at step 2, with nothing but a phone.**

Everything except `phone` is nullable on `User`. The moment the code is
verified we insert a row and hand it back. The app is then "logged in" with an
incomplete profile, which is exactly what steps 3–5 fill in.

`status` tracks the progress, using the enum that already existed:

```
PENDING  → phone verified, profile not finished
ACTIVE   → profile complete, can use the app
BLOCKED / SUSPENDED → moderation
```

A returning user gets the same row back — one row per phone, forever.

**`verify-otp` tells the app which screen to show next**, via `accountState`:

| `accountState`          | Meaning                                    | App shows              |
| ----------------------- | ------------------------------------------ | ---------------------- |
| `COMPLETE_PROFILE`      | customer branch (or role not picked yet)   | onboarding → profile page |
| `SUBMIT_DOCUMENTS`      | technician branch, documents not sent yet  | national id + criminal record form |
| `WAITING_FOR_APPROVAL`  | technician sent documents, admin hasn't decided | "under review" screen |
| `VERIFICATION_REJECTED` | admin rejected the documents               | re-upload screen       |
| `READY`                 | done                                       | home                   |
| `BLOCKED` / `SUSPENDED` | moderation                                 | error screen           |

A matching `message` comes back with it, so the app has something to display
without inventing wording.

This is computed in one place — `resolveAccountState` in
`src/modules/users/users.state.ts` — because two columns decide it together
(`User.status` **and** `TechnicianProfile.verificationStatus`). Never re-derive
it by hand in a route; call that function.

### "Waiting for approval", specifically

A technician is **never** `READY` on their own. The sequence is:

```
picks TECHNICIAN               role = TECHNICIAN, no profile row yet
                               → accountState SUBMIT_DOCUMENTS
        ↓
submits documents (task 3)     TechnicianProfile created, verificationStatus = PENDING
                               → accountState WAITING_FOR_APPROVAL
        ↓
admin approves (task 5)        verificationStatus = VERIFIED, user.status = ACTIVE
                               → accountState READY
        ↓ (or)
admin rejects (task 5)         verificationStatus = REJECTED, user.status stays PENDING
                               → accountState VERIFICATION_REJECTED, can resubmit
```

They stay in `WAITING_FOR_APPROVAL` however many times they close and reopen
the app — logging in again returns the same state, so they are never pushed
back through onboarding. **That already works**; it starts the moment task 3
creates the `TechnicianProfile` row. You do not have to build it.

**2. Step 4 splits the flow in two, and the choice is saved.**

`PATCH /me/role` stores the answer and replies with the state that tells the
app where to go:

```
selects CUSTOMER    → COMPLETE_PROFILE   app opens, land on the profile page
selects TECHNICIAN  → SUBMIT_DOCUMENTS   land on the national id / criminal
                                         record form instead
```

Saving it matters for two reasons. A technician must never be routed to the
customer profile page — they have their own, longer form. And if either user
closes the app halfway, logging back in returns the *same* state, so they
resume exactly where they stopped instead of starting over.

The role is locked once onboarding finishes (409 after documents are submitted,
or once the account is ACTIVE) — otherwise a technician could flip to customer
and strand their profile, offers and reviews. `ADMIN` is rejected outright: the
schema does not accept it, so nobody promotes themselves by calling their own
account endpoint.

**The technician form is the customer form plus documents.** Because a
technician skips the profile page, `POST /technician/profile` collects the same
name / city / address / location *and* the national id and criminal record, in
one submission.

### Two profile endpoints, not one

```
POST /api/v1/customer/profile      ← the app calls this if CUSTOMER was picked
POST /api/v1/technician/profile    ← this one if TECHNICIAN was picked
```

Same verb, same shape of URL, same response envelope — the app just picks the
one matching the role it already chose on the previous screen.

It is tempting to have a single `POST /users/profile` with a `role` field
instead. Don't: the two payloads genuinely differ (a technician also sends
`categoryId`, `nationalId`, `criminalRecordFile`), so one endpoint would need
"these fields are required *only* when role is TECHNICIAN" conditional
validation. Two endpoints means each has one flat, obvious payload — easier to
validate, easier to document, and the frontend already knows which branch it is
on.

Neither endpoint creates a *user*. That row was created when the OTP was
verified. The customer one fills in the blanks on it; the technician one fills
in the blanks **and** creates the `TechnicianProfile` row.

#### The contract

Both reply with the same envelope, so the app can handle them with one code path:

```jsonc
// 201 Created
{
  "data": {
    "user": { "id": "12", "fullName": "…", "role": "CUSTOMER", "status": "ACTIVE", … },
    "accountState": "READY",              // technician: "WAITING_FOR_APPROVAL"
    "message": "Your account is ready"
  }
}
```

The technician response also carries `technicianProfile`.

```jsonc
// POST /api/v1/customer/profile     Authorization: Bearer <accessToken>
{
  "fullName": "Mona Ali",
  "city": "Giza",
  "address": "12 Nile St",
  "latitude": 30.0131,
  "longitude": 31.2089
}

// POST /api/v1/technician/profile  — the same five, plus three
{
  "fullName": "Karim Fathy",
  "city": "Cairo",
  "address": "5 Tahrir",
  "latitude": 30.0444,
  "longitude": 31.2357,

  "categoryId": "1",                            // picked back on screen 3
  "nationalId": "/uploads/1712-nid.jpg",        // URL from POST /public/uploads
  "criminalRecordFile": "/uploads/1712-rec.pdf",// optional
  "profileImage": "/uploads/1712-me.jpg"        // optional
}
```

Neither body carries a `userId`: the profile always belongs to the caller, and
the route reads that from the token. Accepting one as a field would let a user
file a profile against somebody else's account.

**3. The category picked at step 3 is only stored for technicians.**

For a technician it is their speciality, and `TechnicianProfile.categoryId`
requires it — the app holds the chosen id and posts it with the documents.

For a customer it is just "what am I shopping for today". There is no column
for it and it doesn't need one: the app keeps it in memory and sends it later
as `categoryId` when the customer creates a service request.

So step 3 is a plain read — list the categories so the user can pick one.

## What is already built

```
POST  /api/v1/public/auth/request-otp     { phone }
POST  /api/v1/public/auth/verify-otp      { phone, otpCode }
POST  /api/v1/public/auth/refresh         { refreshToken }
GET   /api/v1/me                          who am I + accountState
PATCH /api/v1/me/role                     { role: "CUSTOMER" | "TECHNICIAN" }
```

Rules baked into `src/modules/auth/auth.service.ts` (all the numbers are named
constants at the top of that file):

- code is 6 digits, valid for **5 minutes**, single use
- **60 seconds** between resends
- **5** wrong guesses locks the phone for **15 minutes**
- `BLOCKED`/`SUSPENDED` users cannot log in, refresh, or use an existing token

`verify-otp` also hands out the JWTs everything else needs — access (15 min)
and refresh (30 days). The guards that check them live in
`src/modules/auth/auth.middleware.ts` and are applied per audience group in
`src/api/index.ts`; the README has the full picture.

There is no SMS provider yet. The code is printed in the `npm run dev` terminal
and returned as `devOtpCode` in the response, which is stripped in production.
Wiring a real provider means editing one function: `sendOtpSms` in
`src/modules/auth/auth.sms.ts`.

---

# Tasks

**The files already exist.** Each task below is a folder under `src/modules/`
with every file created, every function named, and every body left empty:

```
src/modules/categories/     task 1    schema · service · mapper · public+admin routes
src/modules/users/
  users.customer.routes.ts  task 2 ✅ done
src/modules/technicians/    tasks 3+5 schema · service · mapper · technician+admin routes
src/modules/uploads/        task 4    public routes
```

They are already mounted in `src/api/`, so the URLs are live and answer `501`.
Nothing needs wiring up — open the file, follow the `TODO(task N)` comments,
replace the `throw ApiError.notImplemented()` with the real body.

The complete, working reference for all of it is `src/modules/users/` — every
pattern you need is in there.

Reminders that apply to all of them:

- **Never `try`/`catch` in a route.** `throw ApiError.notFound("…")`; the error
  handler turns it into JSON.
- **No SQL in a route file, no `req`/`res` in a service file.**
- **Ids are BigInt** — parse them with `idParams` from `src/core/fields.ts`.
- **Filter `deletedAt: null`** on anything that reads users.
- `npm run typecheck` before you push.

## Task 1 — Categories (start here)

The simplest possible module, and the one screen 3 needs.

```
GET    /api/v1/public/categories        list, no pagination — there are few
GET    /api/v1/admin/categories/:id
POST   /api/v1/admin/categories         { name, homeVisitBasePrice }
PATCH  /api/v1/admin/categories/:id
DELETE /api/v1/admin/categories/:id
```

- Model: `Category` (already in `schema.prisma`).
- `name` is unique — a duplicate already returns 409 on its own, no check needed.
- `homeVisitBasePrice` is a `Decimal`. **Return it as a string**
  (`price.toString()`), never a float.
- Mount the public list in `src/api/public.ts`, the rest in `src/api/admin.ts`.

## Task 2 — Customer creates their profile ✅ done

Screen 5a. Turns a phone-only row into a usable account.

```
POST /api/v1/customer/profile        Authorization: Bearer <accessToken>
  { fullName, city, address, latitude, longitude }
```

- All five profile fields are required here, even though the columns are
  nullable — nullable means "not filled in *yet*", and this is the screen that
  fills them in.
- On success set `status` to `ACTIVE`. That is what makes the account usable.
- Reply `201` with `{ user, accountState, message }` — see *The contract*
  above. Take the state from `resolveAccountState(user, null)`, never hardcode
  `"READY"`.
- 404 if the user doesn't exist or is soft-deleted; 409 if they already
  finished (`status !== PENDING`), the way `selectRole` does.
- `users.service.ts` already has almost all of this — reuse `updateUserFields`
  rather than writing new Prisma calls.

> No `userId` in the body: the group is behind `requireAuth` +
> `requireRole("CUSTOMER")`, so the caller is already known. Read them with
> `currentUser(req)` from `modules/auth/auth.middleware.js` and pass the id to
> the service — the technician twin does exactly this.

## Task 3 — Technician submits documents ✅ done

Screen 5b. Kept here as the worked example for task 2 — it is the same shape,
and it shows where the caller's id comes from. Still depends on task 4 for the
file URLs themselves.

```
POST /api/v1/technician/profile      Authorization: Bearer <accessToken>
  { fullName, city, address, latitude, longitude,   ← same as the customer form
    categoryId, nationalId, criminalRecordFile?, profileImage? }
```

The technician skips the profile page entirely, so this one form collects their
personal details **and** their documents. Import `profileFields` from
`users.schema.ts` instead of retyping the first five.

- Model: `TechnicianProfile`. `userId` is unique — one profile per user.
- Do all of this **in one `prisma.$transaction`**, because they must not half-happen:
  1. write the personal details onto the `User` row (role is already
     `TECHNICIAN` from step 4, but setting it again is harmless)
  2. create the `TechnicianProfile` with `verificationStatus: PENDING`
- Leave the user's `status` as `PENDING` — a technician is not active until an
  admin approves them (task 5).
- Return `accountState: "WAITING_FOR_APPROVAL"` and its `message` alongside the
  profile, so the app can show the "under review" screen straight away instead
  of making a second call. Get both from `modules/users/users.state.js`.
- `nationalId` and `criminalRecordFile` are **URL strings**, not files. The
  upload happens first (task 4) and the client sends back the returned URLs.

## Task 4 — File upload

Needed by task 3.

```
POST /api/v1/public/uploads    multipart/form-data, field name "file"
  → { data: { url: "/uploads/1712345678-national-id.jpg" } }
```

- Use `multer` with disk storage into an `uploads/` folder (add it to
  `.gitignore`), and serve it with `express.static`.
- Accept `image/jpeg`, `image/png`, `application/pdf` only. Max 5 MB.
- Rename every file — never trust the client's filename.
- Local disk is fine for now; S3 can replace this one module later.

## Task 5 — Admin approves a technician

The last step before a technician can receive work.

```
PATCH /api/v1/admin/technicians/:id/verification
  { verificationStatus: "VERIFIED" | "REJECTED" }
```

- On `VERIFIED`, also set the **user's** `status` to `ACTIVE` (transaction again).
- On `REJECTED`, leave the user `PENDING` so they can resubmit.
- Also worth adding: `GET /api/v1/admin/technicians?verificationStatus=PENDING`
  so admins can find the queue — copy the list/filter code from
  `users.service.ts`.

## Suggested order

Task 1 alone (easiest, teaches the module shape) → then 4 → then 2 and 3 in
parallel → then 5.
