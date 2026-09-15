# SchoolOS Phase 4 Build Guide: Portals & Communication (PHASE_4.md)

This file is context for Claude Code working in this repository. Read `CLAUDE.md` first: it has the product summary, the non-negotiable architectural rules, the RBAC model, and the Phase 0+1 schema this phase builds on top of. This file only adds what's new for Phase 4. Do not repeat or re-litigate anything already decided in `CLAUDE.md`.

## Where this phase sits

Phase 0 (Foundation) and Phase 1 (Core School) are assumed complete: tenant/campus architecture, auth + RBAC, students/parents/classes/attendance/results all exist and are tenant-scoped. **Phase 2 (Fees/Payments) and Phase 3 (HR/Payroll) are explicitly *not* built yet**: this phase must not require them to exist. Where the spec calls for something that depends on money or payroll data (e.g. "payment reminders"), build the generic mechanism now and leave the actual trigger as a documented stub/interface that Phase 2 wires up later. Do not fake fee data to make a reminder demo work.

This phase covers spec sections 4.10 (Parent/Student/Teacher Experience) and 4.11 (Communication).

## What Phase 4 delivers

1. **Parent portal API**: read-only views scoped to a parent's own linked children, plus the two actions parents are allowed: submitting admission applications and (later) paying online. Payment itself is out of scope; the endpoint shape for "pay" can exist as a stub that 501s or defers to Phase 2.
2. **Teacher portal API**: a teacher's own view of their assigned classes/subjects: attendance entry, result entry, timetable view, assignments/learning resources for their classes, and messaging their students' parents.
3. **Student portal API**: a student's own view of their own records, age-gated per policy.
4. **Notifications**: in-app notifications, with email and SMS as pluggable delivery channels (WhatsApp adapter interface too, but implementation can be stubbed if no provider is configured).
5. **Communication module**: targeted messaging (school/campus/class/arm/parent-group/individual), message templates, bulk announcements, delivery status tracking, and communication history.
6. **Assignments & learning resources**: thin version: a teacher posts an assignment to a class, students/parents can view it. No submission grading pipeline yet unless already covered elsewhere.

## Non-negotiable rules specific to this phase

These extend (not replace) the ten rules in `CLAUDE.md`.

1. **Portal scoping is enforced server-side, not just hidden in the UI.** A Parent's JWT resolves to a set of `studentId`s via `StudentGuardian`: every parent-portal query filters by that set, derived from the session, never from a request parameter. The same applies to a Teacher's assigned classes (`TeacherSubjectAssignment`) and a Student's own `studentId`.
2. **No cross-family leakage in bulk operations.** A targeted announcement to "JSS 2 Gold parents" must resolve recipients through the tenant-scoped roster at send time; never accept a client-supplied recipient list for a role below Principal/Proprietor.
3. **Communication is logged, not just sent.** Every outbound message (in-app, email, SMS, WhatsApp) writes a `CommunicationLog` row with recipient, channel, template used (if any), delivery status, and timestamps. This is separate from `AuditLog` (communication history is operational, not the sensitive-action audit trail) but both should exist.
4. **Delivery is provider-agnostic and gracefully degrades.** Build a `NotificationProvider` interface (in-app always works; email/SMS/WhatsApp are adapters behind it). If no SMS/email provider is configured, in-app notifications and queued history must still work, per the build file's launch-readiness point: "core workflows remain usable when external messaging providers are unavailable."
5. **Idempotent sends.** A notification job must not double-send on retry. Use a dedupe key (e.g. `entityType + entityId + eventType + recipientId`) before dispatching.
6. **Student age-gating is policy-driven, not hardcoded.** Add a `minAgeForPortalFeature` style config (even a simple tenant-level setting) rather than baking an age number into guard logic: schools may set this differently.
7. **Payment reminders are a documented no-op interface for now.** Define the trigger point (e.g. `ReminderService.notifyOutstandingBalance(studentId)`) and the `CommunicationLog` shape it would write, but the actual scheduling/data source is Phase 2's job. Do not stub in fake balances.

## Data model additions for Phase 4

Add these to the Prisma schema (`packages/database/prisma/schema.prisma`), following the same tenant-scoping and indexing conventions as the Phase 0+1 models: every tenant-owned table gets `tenantId` and an index on it.

- `Notification`: `id, tenantId, recipientUserId, type, title, body, entityType?, entityId?, readAt?, createdAt`. In-app notifications a user sees in their portal.
- `MessageTemplate`: `id, tenantId, name, channel (IN_APP|EMAIL|SMS|WHATSAPP), subject?, body, placeholders (Json), createdAt, updatedAt`. Reusable templates for announcements, payment reminders (later), result-publication notices, etc.
- `CommunicationLog`: `id, tenantId, senderUserId?, channel, templateId?, recipientUserId?, recipientContact? (email/phone snapshot), targetDescription (e.g. "JSS 2 Gold parents"), subject?, body, status (QUEUED|SENT|DELIVERED|FAILED), providerRef?, sentAt?, createdAt`. This is the "delivery status and communication history" the spec asks for.
- `Assignment`: `id, tenantId, classArmId, subjectId?, createdByStaffProfileId, title, description, resourceUrl?, dueDate?, createdAt, updatedAt`. Kept thin, no submission/grading model yet, just visibility to the class's students/parents.
- `Announcement`: `id, tenantId, campusId?, audience (SCHOOL|CAMPUS|CLASS|ARM|PARENT_GROUP|INDIVIDUAL), audienceRefId?, title, body, createdByUserId, publishedAt, createdAt`. Drives the "bulk announcements" requirement; `CommunicationLog` rows are the fan-out record of who actually received it.

None of these need a `campusId` where they're already reachable via a relation that carries one (e.g. `Assignment` reaches campus through `ClassArm`), except where the audience is campus-wide and there's no other path to scope it.

## Suggested module layout

```
src/modules/
  portals/
    parent-portal/        # read-only aggregation over students, results, attendance, timetable
    teacher-portal/        # aggregation over assigned classes + write endpoints (attendance, results already exist, portal just exposes "my" views)
    student-portal/
  notifications/
    notification.service.ts        # writes Notification rows, dispatches to providers
    providers/
      in-app.provider.ts
      email.provider.ts             # adapter interface; stub/no-op if unconfigured
      sms.provider.ts                # adapter interface; stub/no-op if unconfigured
      whatsapp.provider.ts           # adapter interface; stub/no-op if unconfigured
  communication/
    templates/
    announcements/
    communication-log/
  assignments/
```

Portal modules should mostly be **read-side aggregations** over existing Phase 0/1 services (students, results, attendance) rather than new sources of truth: a parent portal "child summary" endpoint composes calls to the students/results/attendance services with the parent's resolved child-id set, it doesn't duplicate their queries.

## Build order for this pass

1. `NotificationProvider` interface + `in-app` implementation (always on): get the abstraction right before wiring any external provider.
2. `Notification` + `CommunicationLog` + `MessageTemplate` schema and migrations.
3. Teacher portal: "my classes," "my students," "my timetable" endpoints, thin wrappers with the assignment-scope filter from `TeacherSubjectAssignment`.
4. Student portal: "my timetable," "my results (published only)," "my attendance," "my notices" endpoints: enforce published-only visibility on results (never expose draft/submitted/approved-but-unpublished results to a student).
5. Parent portal: resolve linked children via `StudentGuardian`, then per-child views mirroring the student portal but multi-child aware (a parent with three kids gets a switcher, not three separate logins).
6. `Assignment` module: teacher create/list/update scoped to assigned classes; student/parent read scoped to their class/child.
7. `Announcement` + audience resolution: given an audience type and ref, resolve the actual recipient user IDs at send time, respecting tenant/campus scope.
8. Wire announcement/result-publication/attendance-alert events to `NotificationService`, which writes `Notification` + `CommunicationLog` rows and calls the configured provider(s).
9. Stub `email` and `sms` providers behind env-driven config (e.g. `EMAIL_PROVIDER=none|sendgrid`, `SMS_PROVIDER=none|termii`) so the system runs with zero external providers configured and upgrades cleanly later.
10. Tests: portal-scoping tests (a parent can never fetch another family's child via any portal endpoint; a teacher can never fetch a class they're not assigned to), idempotent-send test (same event fired twice does not duplicate a `CommunicationLog` row), and a "no provider configured" test proving in-app notifications and history still work.

## Do not build yet (explicit non-goals for this pass)

Actual email/SMS/WhatsApp provider integrations beyond a stub adapter (pick one real provider only if the user asks for it explicitly, otherwise leave `NONE` as the default), payment reminders' real trigger (depends on Phase 2 fee data), assignment submission/grading, fee balance or payment views in the parent portal (stub the "pay" action as `501 Not Implemented` with a clear message rather than faking a balance), AI-drafted communications (Phase 5), timetable conflict detection (Phase 6 territory: this phase only *displays* timetable data that Phase 1's basic timetable, if any, or a manually seeded one provides).

## Definition of done for this pass

- A parent with multiple children can log in and see only their own children's results/attendance/timetable/assignments/notices, verified by a test, not just inspection.
- A teacher can see and act on only their assigned classes/subjects; hitting another class's endpoint returns a permission denial, not the data.
- A student sees only published results, never draft/submitted/approved-but-unpublished ones.
- An announcement targeted at a class/arm/campus resolves to the correct recipient set at send time and produces one `CommunicationLog` row per actual recipient.
- The system runs end-to-end with no email/SMS/WhatsApp provider configured: in-app notifications and communication history still work, nothing throws.
- Firing the same notification-triggering event twice does not produce duplicate `CommunicationLog` rows.
- `docker-compose up` + the existing seed command still gets a reviewer to a working API in under five minutes, now including a demo parent/teacher/student account each with something in their portal to look at.
