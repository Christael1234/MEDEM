# Testing the Render Deployment

This is for whoever is testing/reviewing the live Render deployment of SchoolOS.

## 1. URL

Live app: `<https://schoolos-api-ma4s.onrender.com>`

Note: Render's free tier spins the service down after inactivity. The **first** request after a period of inactivity can take 30-60 seconds to respond while it cold-starts: this is expected, not a bug.

## 2. Default admin login

| Field | Value |
|---|---|
| Email | `admin@admin.com` |
| Password | `password123` |
| Role | Proprietor (full access across the tenant) |
| Tenant | Greenfield Schools |

This account has been created directly on the Render production database and is ready to use.

Go to `/staff-login.html` (there's also a "Staff or admin? Sign in here" link from the main sign-in page at `/`) and log in with the credentials above. The main `/` page is Student/Parent sign-in only — Staff and Admin logins live on their own page now.

## 3. What to test

As Proprietor, `admin@admin.com` has full access. A reasonable smoke-test pass:

- **Login/session**: log in, confirm the dashboard loads, refresh the page and confirm the session persists (no forced re-login).
- **Students**: Students tab: view the seeded roster, open a student's detail view, create a new student (pick a class/level, confirm arm assignment happens automatically; for Senior Secondary, confirm the Science/Art stream selector appears and the assigned arm matches the chosen stream). Try the Level/Class/Arm filters.
- **Bulk import**: Settings > Bulk import: download the students CSV template, fill in a couple of rows, upload it, and confirm real students get created with real per-row success/failure feedback.
- **Classes & Academics**: Academics tab: view classes/arms, open a class and confirm arms + subjects show correctly; for a Senior Secondary class, confirm each arm's Stream (Science/Art) is set correctly. Check the "Marks entries flagged" KPI highlights any flagged rows.
- **Timetable**: generate a timetable for a class; open "Break times…" and confirm break windows can be edited and regenerate reflects them; confirm Nursery classes get a shorter day (one period per subject) vs JSS/SS getting a full day.
- **Stream change requests**: as a student in SS1 (log in as a seeded student account if one exists, or check via admin), confirm a stream-change request can be submitted and that admin sees it under Students > stream requests, and can approve/reject it.
- **Attendance**: mark attendance for a class, confirm it saves and shows in the summary. Try the Level/Class/Arm filters, and check the "School attendance today" and "Flagged absentees" numbers on the overview page.
- **Results**: create/submit a result and walk it through draft to submitted to approved to published (as applicable to your role).
- **Document templates**: Settings > Document templates: preview a template (should render against a real student/term if one exists), edit its content, and publish the new version.
- **Reports**: Reports page: generate the Attendance summary, Academic performance, Enrollment summary, and Staff directory reports, and confirm Download CSV produces a real file with the generated data.
- **Notifications**: click the bell icon in the topbar and confirm the dropdown loads (may be empty if nothing has triggered a notification yet).
- **Settings > Appearance/Branding**: as Proprietor, change the primary/sidebar color and the school display name/logo/login copy, and confirm it applies live across the app and on both sign-in pages (for a browser that's signed in at least once — see the branding note below).
- **Session/Term controls**: check the session/term badge in the topbar; try activating a different term and confirm it updates app-wide.
- **Multi-tenant isolation (if a second tenant/login is available)**: confirm you cannot see another tenant's students, classes, or data under any circumstance.

## 4. Reporting issues

For any bug, please note:
- The exact page/action taken
- Expected vs actual behavior
- Browser console errors (F12 > Console tab), if any
- Whether it also reproduces on local dev, if you have that set up

## 5. Known limitations (not bugs)

- Free-tier Render has no Shell access, so admin/database changes must go through the app UI, the API, or a script run against the External Database URL by the repo owner.
- Fees/payments/payroll/HR beyond a thin staff profile/communications modules are **not built yet**: this pass covers Foundation + Core School, plus academics, attendance, timetable, document templates, bulk import, reports, and branding.
- A brand-new browser that's never signed in before will see the default branding (school name, colors, logo) on the sign-in pages, not this tenant's custom branding — there's no way to know which school a visitor belongs to before they identify themselves (this is a shared, multi-tenant sign-in URL, not a per-school subdomain). It shows correctly after the first successful login on that browser.
- Cold starts (see §1) are a Render free-tier characteristic, not a performance bug in the app.
