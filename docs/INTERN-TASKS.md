# What to build

31 functions, 5 tasks — tasks 2 and 3 are already done, so 23 are left. The files
already exist and are already plugged into the API — each has a
`throw ApiError.notImplemented()` where your code goes, and a `TODO` comment
with the details.

| Task | What | Items | Who |
| ---- | ---- | ----- | --- |
| 1 | Categories | 13 | |
| 2 | Customer profile | 3 | ✅ done |
| 3 | Technician profile | 5 | ✅ done |
| 4 | File upload | 3 | |
| 5 | Admin approval | 7 | |

Order: **1 → 4 → 5.** Tasks 2 and 3 are finished; read them as the worked
examples — and note that task 5 touches the same files as task 3.

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

# Task 1 — Categories

The list of fields (plumbing, electrical…) shown on screen 3, plus admin
management. Start here.

**`categories.schema.ts`**

- [ ] `createCategoryBody` — `name` (2–100), `homeVisitBasePrice` (positive, 2dp)
- [ ] `updateCategoryBody` — both optional, reject `{}`. Copy `updateUserBody`.

**`categories.service.ts`**

- [ ] `listCategories()` — all, ordered by name. No pagination.
- [ ] `getCategoryById(id)` — or `throw ApiError.notFound("Category not found")`
- [ ] `createCategory(data)` — `name` is unique, duplicates 409 by themselves
- [ ] `updateCategory(id, data)` — missing row 404s by itself
- [ ] `deleteCategory(id)` — real delete. In use → 409, which is correct.

**`categories.mapper.ts`**

- [ ] `toCategoryResponse(category)` — id as string, price as string

**`categories.public.routes.ts`**

- [ ] `GET /` → `{ data: [...] }`, no `meta`

**`categories.admin.routes.ts`**

- [ ] `GET /:id` → 200
- [ ] `POST /` → 201
- [ ] `PATCH /:id` → 200
- [ ] `DELETE /:id` → 204, empty

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
      `users.schema.ts`), `categoryId`, `nationalId`, optional
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
       "nationalId":"/uploads/nid.jpg"}'
```

201 with `WAITING_FOR_APPROVAL`. Log in again → still `WAITING_FOR_APPROVAL`,
never `COMPLETE_PROFILE`. Response must not contain `nationalId`.

---

# Task 4 — File upload

The app uploads each document, gets a URL, sends those URLs with task 3's form.

```bash
npm install multer && npm install -D @types/multer
```

**`uploads.public.routes.ts`**

- [ ] `POST /` — `multipart/form-data`, field `file` → 201
      `{ data: { url: "/uploads/…" } }`

      Multer: disk storage into `uploads/`; rename every file yourself
      (`${Date.now()}-${randomUUID()}${ext}` — never reuse the client's name);
      jpeg/png/pdf only; max 5 MB.

**`app.ts`**

- [ ] `app.use("/uploads", express.static("uploads"));`

**`core/error-handler.ts`**

- [ ] A `MulterError` branch → 400 instead of 500

### Test it

```bash
curl -X POST localhost:3000/api/v1/public/uploads -F 'file=@photo.jpg'  # 201
curl localhost:3000/uploads/THE-RETURNED-NAME                           # the file
curl -X POST localhost:3000/api/v1/public/uploads -F 'file=@big.zip'    # 400
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

## Done means

1. `npm run typecheck` exits 0
2. Every curl above does what it says
3. No `notImplemented` left in your files

## Later, not now

Service requests · technician offers · reviews · AI estimation ·
a real SMS provider · per-device token revocation.
