# Testing the Render Deployment

This is for whoever is testing/reviewing the live Render deployment of SchoolOS.

## 1. URL

Live app: `<PASTE RENDER SERVICE URL HERE, e.g. https://schoolos-api.onrender.com>`

Note: Render's free tier spins the service down after inactivity. The **first** request after a period of inactivity can take 30–60 seconds to respond while it cold-starts: this is expected, not a bug.

## 2. Default admin login

| Field | Value |
|---|---|
| Email | `admin@admin.com` |
| Password | `password123` |
| Role | Proprietor (full access across the tenant) |
| Tenant | Greenfield Schools |

Log in from the app's login page (`/` or `/index.html`) with the credentials above.

> **If login fails with "invalid credentials":** this account was seeded manually and may not exist yet on the Render database (it lives in a separate Postgres instance from local dev, creating it locally does not create it on Render). Ping the repo owner to (re)run the admin-seed script against Render's database before testing. It is not created automatically by `prisma migrate deploy`.

## 3. What to test

As Proprietor, `admin@admin.com` has full access. A reasonable smoke-test pass:

- **Login/session**: log in, confirm the dashboard loads, refresh the page and confirm the session persists (no forced re-login).
- **Students**: Students tab: view the seeded roster, open a student's detail view, create a new student (pick a class/level, confirm arm assignment happens automatically; for Senior Secondary, confirm the Science/Art stream selector appears and the assigned arm matches the chosen stream).
- **Classes & Academics**: Academics tab: view classes/arms, open a class and confirm arms + subjects show correctly; for a Senior Secondary class, confirm each arm's Stream (Science/Art) is set correctly.
- **Timetable**: generate a timetable for a class; open "Break times…" and confirm break windows can be edited and regenerate reflects them; confirm Nursery classes get a shorter day (one period per subject) vs JSS/SS getting a full day.
- **Stream change requests**: as a student in SS1 (log in as a seeded student account if one exists, or check via admin), confirm a stream-change request can be submitted and that admin sees it under Students → stream requests, and can approve/reject it.
- **Attendance**: mark attendance for a class, confirm it saves and shows in the summary.
- **Results**: create/submit a result and walk it through draft → submitted → approved → published (as applicable to your role).
- **Settings → Appearance**: as Proprietor, change the primary/sidebar color and confirm it applies live across the app (sidebar, buttons) without a full reload being required elsewhere.
- **Session/Term controls**: check the session/term badge in the topbar; try activating a different term and confirm it updates app-wide.
- **Multi-tenant isolation (if a second tenant/login is available)**: confirm you cannot see another tenant's students, classes, or data under any circumstance.

## 4. Reporting issues

For any bug, please note:
- The exact page/action taken
- Expected vs actual behavior
- Browser console errors (F12 → Console tab), if any
- Whether it also reproduces on local dev, if you have that set up

## 5. Known limitations (not bugs)

- Free-tier Render has no Shell access, so admin/database changes must go through the app UI, the API, or a script run against the External Database URL by the repo owner.
- Fees/payments/payroll/HR/communications modules are **not built yet**: this pass only covers Foundation + Core School (students, classes, attendance, results, timetable, academics, settings).
- Cold starts (see §1) are a Render free-tier characteristic, not a performance bug in the app.
