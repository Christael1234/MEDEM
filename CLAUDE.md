# SchoolOS — Backend Build Guide (CLAUDE.md)

This file is context for Claude Code working in this repository. Read it fully before writing code. It summarizes the product spec, the access-control spec, and the decisions already made about how to build the backend. Two source documents this was distilled from are `SchoolOS_Detailed_Build_File.docx` and `SchoolOS_Access_Control.docx` — if they exist in this repo, treat them as the source of truth for anything this file simplifies or omits.

## What SchoolOS is

A multi-tenant SaaS "school business operating system" for private primary/secondary schools, Nigeria-first. It is not a simple school records app — it unifies school administration, academics, attendance, fees/billing, payments & reconciliation, finance, HR, payroll, parent/teacher/student portals, communication, workflow automation, and an AI intelligence layer, all feeding a **Proprietor Control Center** dashboard that surfaces exceptions and trends rather than making the owner inspect every module.

The moat is the data relationships, not the individual modules: `student ↔ parent ↔ class ↔ teacher ↔ attendance ↔ results ↔ fees` and `employee ↔ attendance ↔ leave ↔ payroll ↔ finance`. Build with those relationships as first-class, not as siloed CRUD modules.

## Decisions already made — do not re-litigate these

- **Language/framework:** Node.js + TypeScript, **NestJS**.
- **Database:** **PostgreSQL**. Use `numeric`/`decimal` types for all money fields — never floating point.
- **ORM:** Prisma is recommended (clean migrations, good TypeScript inference, easy to enforce row-level tenant scoping in a middleware/extension). TypeORM is acceptable if there's a strong reason to prefer it, but pick one and don't mix.
- **Auth:** JWT-based session auth (access + refresh tokens), password hashing with bcrypt/argon2. MFA is mandatory for Proprietor, Bursar/Finance, HR, and Super Admin roles — build the schema/hooks for MFA now even if the UI lands later.
- **First build scope: Phase 0 (Foundation) + Phase 1 (Core School).** Do not start Phase 2 (fees/payments) or later until Phase 0+1 is solid and reviewed. See "Build order" below.

## Non-negotiable architectural rules

These come directly from the spec's security and financial-integrity sections. Violating them is a correctness bug, not a style issue.

1. **Tenant isolation is absolute.** Every tenant-owned record carries `tenant_id` (and `campus_id` where applicable). The data-access layer must enforce tenant scoping *by default* — every query, not opt-in per query. A missing filter must not be able to leak data.
2. **Never trust client-supplied tenant/campus IDs.** `tenant_id` and `campus_id` are derived from the authenticated session (JWT claims → request context), never from the request body, query string, or route params.
3. **Deny by default.** A user has no access to a module or record until a role and scope explicitly grant it.
4. **Three access layers, most-restrictive-wins:** tenant isolation → role permissions → campus/module scope. A request is only permitted when all three allow it.
5. **Audit the sensitive set.** Payments, payroll actions, results, permission changes, and sensitive profile changes must write to an immutable audit log (who, what, when, before/after where relevant).
6. **Financial data is ledger-like.** Payments are immutable events; corrections are reversals/adjustments, never silent edits. Store money as decimal, store timestamps in UTC with school timezone applied only for display.
7. **State machines, not booleans.** Invoices: `draft → issued → partially_paid → paid → overdue → cancelled/refunded`. Results: `draft → submitted → approved → published`. Payroll: `draft → calculated → reviewed → approved → finalized`. Model these as explicit enums/state machines with guarded transitions, not ad-hoc status strings.
8. **Idempotency.** Every async operation (esp. payment webhooks) must be idempotent and safely replayable. Verify and persist every external webhook before acting on it.
9. **No internal DB IDs in public URLs where avoidable** — prefer opaque/public identifiers for anything student/parent-facing.
10. **Soft-delete only where legally/operationally appropriate**; preserve audit history for sensitive records regardless.

## Roles (RBAC) — build this into the permission system from day one

Even though Phase 0+1 doesn't touch fees/payroll, the User/Role model must support the full role set now, because retrofitting RBAC later is expensive.

**Platform role:**
- `SUPER_ADMIN` — operates the platform, not any single school. No default access to a tenant's student/financial/HR/payroll data. Any support access into a tenant must be explicit, time-boxed, and audited.

**Tenant roles:**
- `PROPRIETOR` / `OWNER` — full authority across every campus in the group. MFA required.
- `PRINCIPAL` — academic/operational lead for assigned campus(es). Full student/admissions/results/attendance management; view-only on fees/finance/payroll; cannot edit money or change roles.
- `BURSAR` / `ACCOUNTANT` — owns money modules; **prepares but does not approve** payroll. Full fees, payments, reconciliation, finance. View-only on student/HR.
- `HR_ADMIN` — owns workforce modules; prepares payroll inputs but cannot approve/finalize payroll. No fee/payment access beyond payroll inputs. View-only on student records.
- `TEACHER` — strictly scoped to assigned classes/subjects. Can take attendance and enter/submit results (not approve/publish them). No access to fees, finance, or other teachers' classes.
- `PARENT` — sees only their own linked children (fee balance, results, attendance, timetable). Can pay online and submit admission applications. No visibility into other families or staff/financial data.
- `STUDENT` — own records only, capabilities age-gated by policy.
- `TRANSPORT` / `LIBRARY` / `OTHER_STAFF` — confined to a single assigned operational module; everything else hidden.
- `COMPLIANCE_ADMIN` — maintains versioned statutory payroll rules (PAYE/pension/NHF) and runs compliance review; cannot prepare/approve/finalize payroll or touch fees/students/HR.

Design the permission model as **role → module-level actions (View/Create/Full)**, further narrowed by **campus scope** and **assignment scope** ("own child", "assigned class"). A `PermissionsGuard` + `@Roles()`/`@RequireScope()` decorators pattern in NestJS fits well. Sensitive actions (payroll approval, refunds, result publication, role/permission changes) should support a dual-control/second-approver hook even if only one approver is wired up initially.

## Data model — core entities for Phase 0 + Phase 1

Foundation (Phase 0):
- `Tenant` (school group), `Campus` (belongs to Tenant)
- `User` (belongs to Tenant, has one `Role`, optional Campus scope(s)), `RefreshToken` / session table
- `AuditLog` (tenant_id, actor_user_id, action, entity_type, entity_id, before/after JSON, created_at)
- Numbering sequence config (for student IDs, invoices, receipts, payroll runs) — build the sequence generator now even though invoices/payroll come later
- File storage abstraction (signed/private URLs, tenant-aware paths) — interface now, local-disk or S3-compatible implementation

Core School (Phase 1):
- `AcademicSession` (e.g. 2025/2026), `Term` (First/Second/Third, belongs to Session)
- `SchoolClass` (e.g. JSS 2), `ClassArm`/`Section` (e.g. JSS 2 Gold)
- `Student` (tenant, campus, biodata, photo, status enum: `applicant | active | suspended | withdrawn | graduated | archived`, current class/arm)
- `Parent`/`Guardian` and `StudentParent` join table (supports multiple children per parent, multiple guardians per student, relationship type)
- `StaffProfile` (linked 1:1 to a `User` with role `TEACHER`/etc. — employment type, department, position; deeper HR fields land in Phase 3 but the profile shell should exist now)
- `TeacherSubjectAssignment`, `Subject` (basic — full academic management can be thin in Phase 1: subjects, class-subject mapping, marks entry is enough; timetable/grading-scale complexity can wait)
- `AttendanceRecord` (student, class, date, status enum `present|absent|late|excused|...` configurable, recorded_by, correction reason + audit trail)
- `Result` (basic: student, subject, term, marks, status enum `draft|submitted|approved|published`)
- `StudentClassHistory` (promotion/transfer trail)

Do not build fee/payment/payroll tables yet — but do not design student/staff tables in a way that makes attaching them later awkward (e.g. give `Student` and `StaffProfile` stable IDs other tables can reference).

## Suggested repo structure

Matches what's in the build file; adapt if NestJS conventions pull you slightly differently, but keep the domain separation:

```
apps/
  api/                 # the NestJS app
packages/
  database/            # Prisma schema + migrations + seed
  auth/                # JWT strategy, guards, RBAC decorators
  config/              # env/config loading
infra/
  docker/              # docker-compose for local Postgres
docs/
  architecture/
tests/
  e2e/
  integration/
```

If a full monorepo (Nx/Turborepo) feels like overkill for Phase 0+1, a single NestJS app with clean module boundaries (`src/modules/tenants`, `src/modules/auth`, `src/modules/students`, etc.) is fine — just keep module boundaries clean so extraction later is a lift-and-shift, not a rewrite.

## Build order for this pass

1. Docker Compose for local Postgres + `.env` handling.
2. Prisma schema for the Phase 0 + Phase 1 entities above, with `tenant_id` on every tenant-owned table and indexes on it.
3. A Prisma middleware/extension (or query-builder base class) that injects `tenant_id` automatically from request context — this is the single most important piece of plumbing; get it right before building feature modules on top of it.
4. Auth module: signup/login, JWT issue + refresh, password hashing, MFA schema (TOTP secret field on `User`, even if verification flow is stubbed).
5. RBAC: `Role` enum, `RolesGuard`, `@Roles()` decorator, campus-scope guard.
6. Audit log module + interceptor that other modules can call/emit into.
7. Tenant + Campus module (CRUD, Super Admin only for tenant creation).
8. Students, Parents, Classes/Arms, Academic Sessions/Terms modules (CRUD + list/filter, tenant + campus scoped).
9. Attendance module (record, correct-with-reason, list/summary).
10. Basic Results module (create/submit draft → approve → publish state machine, scoped to teacher's assigned classes for create).
11. Seed script: one demo tenant with one campus, one user per role, a handful of students/classes, so the frontend prototype (`schools.html`/`app.js` in this repo, if present) has something real to point at.
12. Tests: tenant-isolation tests (a user from tenant A can never read tenant B's data via any endpoint) and permission-regression tests (each role hits each endpoint, assert allow/deny) are the two suites that matter most at this stage — write these before considering Phase 0+1 "done."

## Do not build yet (explicit non-goals for this pass)

Fees/billing, payments/reconciliation, finance, payroll, HR beyond a thin staff profile, parent/student portals, communications (email/SMS/WhatsApp), AI layer, procurement/inventory, timetable conflict detection, admissions pipeline. These are real modules in the full spec (see the build file's Phase 2–6) — just not this pass.

## Definition of done for this pass

- A tenant with multiple campuses can be created and users can only ever see/act on their own tenant's data (verified by tests, not just by inspection).
- Every role in the RBAC spec exists, maps to real guards, and has at least one passing "allowed" and one passing "denied" test against a real endpoint.
- Students, parents (with multi-child linking), classes/arms, academic sessions/terms, attendance, and basic results all have working CRUD + the state transitions specified above.
- Every write to attendance corrections, result approvals, and any role/permission change produces an audit log entry.
- `docker-compose up` + one seed command gets a reviewer to a working API with demo data in under five minutes.
