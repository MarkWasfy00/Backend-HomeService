# App flow — which API to call, when

For whoever is building the app. Every screen, the call it makes, and what to
do with the answer.

Base URL: `http://localhost:3000/api/v1`

> **No auth yet.** No token, no headers — just `content-type: application/json`.
> Once JWT lands, every call below gets an `Authorization: Bearer …` header and
> the `userId` fields disappear (the server reads them from the token). Nothing
> else about the flow changes.

## The whole journey

```
  ┌─────────────────┐
  │ 1. Enter phone  │  POST /public/auth/request-otp
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │ 2. Enter code   │  POST /public/auth/verify-otp
  └────────┬────────┘
           │  → returns accountState, which decides everything below
           ▼
  ┌─────────────────┐
  │ 3. Pick a field │  GET /public/categories
  │    (plumbing…)  │  keep the chosen id in memory
  └────────┬────────┘
           ▼
  ┌─────────────────────────┐
  │ 4. Customer or          │  PATCH /public/onboarding/:userId/role
  │    technician?          │
  └───┬─────────────────┬───┘
      │ CUSTOMER        │ TECHNICIAN
      ▼                 ▼
 ┌──────────┐    ┌──────────────────┐
 │ 5a.      │    │ 5b. Same fields  │  POST /public/uploads  (×2)
 │ Profile  │    │  + national ID   │  then
 │ form     │    │  + criminal rec. │  POST /technician/profile
 └────┬─────┘    └────────┬─────────┘
      │                   ▼
      │           ┌──────────────────┐
      │           │ Waiting for      │  no call — poll by logging in again,
      │           │ admin approval   │  or wait for a push notification
      │           └────────┬─────────┘
      │                    │ admin approves
      ▼                    ▼
 ┌────────────────────────────┐
 │        Profile screen      │
 └────────────────────────────┘
```

---

## Screen 1 — Enter phone

```http
POST /public/auth/request-otp
{ "phone": "+201112223334" }
```

```jsonc
// 200
{ "data": { "expiresAt": "2026-08-02T08:23:40.510Z", "devOtpCode": "764249" } }
```

- `devOtpCode` only exists while there is no SMS provider. **Use it to test**,
  and never show it in the UI — it disappears in production.
- Start a 60-second countdown before enabling "resend". Asking sooner returns
  `429` with the seconds left in the message.
- Show `expiresAt` as a 5-minute countdown on the next screen.

## Screen 2 — Enter the 6-digit code

```http
POST /public/auth/verify-otp
{ "phone": "+201112223334", "otpCode": "764249" }
```

```jsonc
// 200
{
  "data": {
    "user": { "id": "12", "phone": "+201112223334", "role": "CUSTOMER",
              "status": "PENDING", "fullName": null, … },
    "isNewUser": true,
    "accountState": "COMPLETE_PROFILE",
    "message": "Please complete your profile"
  }
}
```

**Store `user.id`** — every call after this needs it (until JWT).

**Then route on `accountState`, not on `isNewUser`.** See the table at the
bottom; it is the same logic every time the app opens.

Failures to handle:

| Response | Meaning | Do |
| --- | --- | --- |
| `400` "Wrong code. 3 attempt(s) left." | wrong digits | show the message, let them retry |
| `400` "This code has expired…" | >5 min | send them back to screen 1 |
| `400` "This code was already used" | replay | back to screen 1 |
| `429` | 5 wrong tries — locked 15 min | show the message, block the form |
| `403` | account blocked/suspended | dead end, show support info |

## Screen 3 — Pick a field

```http
GET /public/categories
```

```jsonc
{ "data": [ { "id": "1", "name": "Plumbing", "homeVisitBasePrice": "150.00" } ] }
```

- Not paginated — there are only a handful.
- **Keep the chosen `id` in app memory.** Nothing is saved server-side at this
  step. A technician sends it later as `categoryId`; a customer sends it when
  creating a service request.
- Prices are **strings**, on purpose. Don't parse them into a float — format
  them for display as-is.

## Screen 4 — Customer or technician?

```http
PATCH /public/onboarding/12/role
{ "role": "TECHNICIAN" }
```

```jsonc
{
  "data": {
    "user": { … "role": "TECHNICIAN" },
    "accountState": "SUBMIT_DOCUMENTS",
    "message": "Please upload your national ID and criminal record to finish signing up"
  }
}
```

Route on the returned `accountState`:

| Picked | `accountState` | Go to |
| --- | --- | --- |
| `CUSTOMER` | `COMPLETE_PROFILE` | screen 5a |
| `TECHNICIAN` | `SUBMIT_DOCUMENTS` | screen 5b |

This is saved, so if the user closes the app here and comes back, screen 2
returns the same state and they land on the right form — never back at this
screen, and a technician never on the customer profile page.

`409` means they already finished signing up; send them home instead.

## Screen 5a — Customer profile

```http
POST /customer/profile
{ "userId": "12", "fullName": "Mona Ali", "city": "Giza",
  "address": "12 Nile St", "latitude": 30.0131, "longitude": 31.2089 }
```

```jsonc
// 201
{ "data": { "user": { … "status": "ACTIVE" },
            "accountState": "READY", "message": "Your account is ready" } }
```

→ Go to the home screen. Done.

## Screen 5b — Technician documents

**Two steps.** Upload each file first, then submit the form with the URLs you
get back.

```http
POST /public/uploads          multipart/form-data, field name "file"
```

```jsonc
// 201
{ "data": { "url": "/uploads/1712345678-national-id.jpg" } }
```

jpeg / png / pdf, max 5 MB. Call it once per file.

```http
POST /technician/profile
{ "userId": "13",
  "fullName": "Karim Fathy", "city": "Cairo", "address": "5 Tahrir",
  "latitude": 30.0444, "longitude": 31.2357,

  "categoryId": "1",                              // from screen 3
  "nationalId": "/uploads/1712-nid.jpg",          // from the upload above
  "criminalRecordFile": "/uploads/1712-rec.pdf",  // optional
  "profileImage": "/uploads/1712-me.jpg" }        // optional
```

```jsonc
// 201
{ "data": { "user": { … "role": "TECHNICIAN", "status": "PENDING" },
            "technicianProfile": { … "verificationStatus": "PENDING" },
            "accountState": "WAITING_FOR_APPROVAL",
            "message": "Your documents are under review. You will be notified once an admin approves your account." } }
```

→ Go to the waiting screen. Show `message`.

The technician form asks for the personal details **as well as** the documents,
because a technician never sees screen 5a.

`409` "Documents were already submitted" means they submitted before — go to
the waiting screen instead.

## The waiting screen

There is nothing to call. A technician stays here until an admin approves them.

To find out when that happens, either:

- **log in again** (screens 1–2) and read the new `accountState`, or
- wait for a push notification, once that is built.

Don't poll `verify-otp` on a timer — it sends a real SMS each time and the
60-second cooldown will start returning `429`.

---

## When the app opens — the only routing table you need

After `verify-otp`, switch on `accountState`:

| `accountState` | Screen | Why |
| --- | --- | --- |
| `COMPLETE_PROFILE` | screen 3 → 4 → 5a | customer branch, or role not picked yet |
| `SUBMIT_DOCUMENTS` | screen 5b | picked technician, documents not sent |
| `WAITING_FOR_APPROVAL` | waiting screen | documents in, admin hasn't decided |
| `VERIFICATION_REJECTED` | screen 5b again | rejected — let them re-upload |
| `READY` | home | done |
| `BLOCKED` / `SUSPENDED` | error screen | moderation; `verify-otp` returns `403` |

Never infer the screen from `role` or `status` yourself — those two columns
have to be read *together*, which is exactly what `accountState` does for you.
If a new state appears later, this table is the only thing that changes.

---

## Conventions across every endpoint

**Success** — one object under `data`; lists add `meta`:

```jsonc
{ "data": { … } }
{ "data": [ … ], "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 } }
```

**Errors** — always the same shape, so one handler covers the whole API:

```jsonc
{ "error": { "code": "validation_error", "message": "…",
             "details": [ { "field": "phone", "message": "phone must be 7-20 digits…" } ] } }
```

| Status | Meaning |
| --- | --- |
| `400` | bad input — `details` lists the offending fields |
| `403` | account blocked or suspended |
| `404` | no such record |
| `409` | duplicate, or an action that no longer applies |
| `429` | too many OTP requests or wrong guesses |
| `501` | **endpoint not built yet** (see below) |
| `500` | our bug — report it |

**IDs are strings**, always. `"id": "12"`, not `12`. They are 64-bit integers
that don't fit in a JavaScript number — keep them as strings end to end.

**Money is a string** too (`"150.00"`). Never parse it into a float.

## What is live today

Working now:

```
POST  /public/auth/request-otp
POST  /public/auth/verify-otp
PATCH /public/onboarding/:userId/role
      + the whole /admin/users section
```

Returns `501 not_implemented` until the team finishes it — the URLs exist, so
you can wire the app up against them now:

```
GET   /public/categories            screen 3
POST  /public/uploads               screen 5b
POST  /customer/profile             screen 5a
POST  /technician/profile           screen 5b
GET   /admin/technicians            back-office approval queue
PATCH /admin/technicians/:id/verification
      + /admin/categories
```

Progress is tracked in [`ONBOARDING-FLOW.md`](ONBOARDING-FLOW.md).
