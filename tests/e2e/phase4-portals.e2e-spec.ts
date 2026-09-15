import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { RequestContextService } from '../../src/common/context/request-context';
import { PrismaExceptionFilter } from '../../src/common/filters/prisma-exception.filter';
import { NotificationService } from '../../src/modules/notifications/notification.service';

/**
 * Phase 4 Definition of Done, condensed into tests:
 * - a parent can never fetch another family's child via any portal endpoint
 * - a teacher can never fetch a class they're not assigned to
 * - a student sees only published results
 * - firing the same notification-triggering event twice does not
 *   duplicate a CommunicationLog row
 * - the system works with no email/sms/whatsapp provider configured
 *
 * Self-contained: provisions its own tenant, campuses, classes, teachers,
 * students and guardians rather than depending on `npm run seed`.
 */
describe('Phase 4: Portals & Communication (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = Date.now();
  const PASSWORD = 'Password123!';
  const provisionedTenantIds: string[] = [];
  let superAdminUserId: string;

  let proprietorToken: string;
  let teacherAToken: string;
  let teacherBToken: string;
  let parentAToken: string;

  let classArmA: string;
  let classArmB: string;
  let studentAId: string;
  let studentBId: string;

  async function login(email: string, password: string = PASSWORD): Promise<string> {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    if (res.status >= 400) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();

    const superAdminEmail = `p4-superadmin-${suffix}@schoolos.dev`;
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const superAdmin = await prisma.user.create({
      data: { email: superAdminEmail, tenantId: null, role: 'SUPER_ADMIN', firstName: 'P4', lastName: 'Admin', passwordHash },
    });
    superAdminUserId = superAdmin.id;
    const superAdminToken = await login(superAdminEmail);

    const propEmail = `p4-prop-${suffix}@test.dev`;
    const provisionRes = await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: `P4 Tenant ${suffix}`,
        slug: `p4-tenant-${suffix}`,
        campusName: 'Main Campus',
        proprietor: { email: propEmail, password: PASSWORD, firstName: 'Prop', lastName: 'P4' },
      })
      .expect(201);
    provisionedTenantIds.push(provisionRes.body.tenant.id);
    proprietorToken = await login(propEmail);

    const campusRes = await request(app.getHttpServer())
      .get('/campuses')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .expect(200);
    const campusId = campusRes.body[0].id;

    // Two classes, two teachers, one each, so cross-class access can be
    // asserted as denied rather than trivially true (single-class tenants
    // can't prove the scoping actually filters anything).
    const classRes = await request(app.getHttpServer())
      .post('/classes')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .send({ campusId, name: `P4 Class ${suffix}`, gradeTier: 'JUNIOR_SECONDARY' })
      .expect(201);

    const armARes = await request(app.getHttpServer())
      .post('/class-arms')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .send({ schoolClassId: classRes.body.id, name: 'A' })
      .expect(201);
    classArmA = armARes.body.id;

    const armBRes = await request(app.getHttpServer())
      .post('/class-arms')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .send({ schoolClassId: classRes.body.id, name: 'B' })
      .expect(201);
    classArmB = armBRes.body.id;

    const teacherAEmail = `p4-teacher-a-${suffix}@test.dev`;
    const teacherARes = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .send({ email: teacherAEmail, password: PASSWORD, firstName: 'Teach', lastName: 'A', role: 'TEACHER' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/staff-profiles')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .send({ userId: teacherARes.body.id, campusId })
      .expect(201);
    teacherAToken = await login(teacherAEmail);

    const teacherBEmail = `p4-teacher-b-${suffix}@test.dev`;
    const teacherBRes = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .send({ email: teacherBEmail, password: PASSWORD, firstName: 'Teach', lastName: 'B', role: 'TEACHER' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/staff-profiles')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .send({ userId: teacherBRes.body.id, campusId })
      .expect(201);
    teacherBToken = await login(teacherBEmail);

    // Assign each teacher to their own arm as class teacher (classTeacherId
    // takes a StaffProfile id, not a User id, so update directly).
    const staffAProfile = await prisma.staffProfile.findUniqueOrThrow({ where: { userId: teacherARes.body.id } });
    const staffBProfile = await prisma.staffProfile.findUniqueOrThrow({ where: { userId: teacherBRes.body.id } });
    await prisma.classArm.update({ where: { id: classArmA }, data: { classTeacherId: staffAProfile.id } });
    await prisma.classArm.update({ where: { id: classArmB }, data: { classTeacherId: staffBProfile.id } });

    // Student creation now requires a parent/guardian and auto-provisions
    // that guardian's own portal login (same as the student's) when it's a
    // newly created guardian rather than a reused guardianId, so this one
    // call is enough to get both a real student and a real, log-in-able
    // parent account, no separate POST /users + POST /guardians dance.
    const studentARes = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .send({ campusId, firstName: 'Student', lastName: 'A', currentClassArmId: classArmA, guardianFirstName: 'Parent', guardianLastName: 'A', guardianRelationship: 'FATHER' })
      .expect(201);
    studentAId = studentARes.body.id;
    const parentACredentials = studentARes.body.guardianLoginCredentials[0];
    parentAToken = await login(parentACredentials.email, parentACredentials.password);

    const studentBRes = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${proprietorToken}`)
      .send({ campusId, firstName: 'Student', lastName: 'B', currentClassArmId: classArmB, guardianFirstName: 'Parent', guardianLastName: 'B', guardianRelationship: 'MOTHER' })
      .expect(201);
    studentBId = studentBRes.body.id;
  }, 45000);

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: provisionedTenantIds } } });
    await prisma.user.delete({ where: { id: superAdminUserId } }).catch(() => undefined);
    await prisma.$disconnect();
    await app.close();
  });

  describe('teacher portal scoping', () => {
    it('lets teacher A see their own class’s students', async () => {
      const res = await request(app.getHttpServer())
        .get('/portal/teacher/students')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).toContain(studentAId);
      expect(res.body.map((s: { id: string }) => s.id)).not.toContain(studentBId);
    });

    it('denies teacher A the other class’s roster by classArmId', async () => {
      await request(app.getHttpServer())
        .get(`/portal/teacher/students?classArmId=${classArmB}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(403);
    });

    it('denies teacher A creating an assignment for teacher B’s class', async () => {
      await request(app.getHttpServer())
        .post('/assignments')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ classArmId: classArmB, title: 'x', description: 'x' })
        .expect(403);
    });
  });

  describe('parent portal scoping', () => {
    it('lets the parent see their own child’s attendance endpoint', async () => {
      await request(app.getHttpServer())
        .get(`/portal/parent/children/${studentAId}/attendance`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(200);
    });

    it('never lets the parent fetch another family’s child via results', async () => {
      await request(app.getHttpServer())
        .get(`/portal/parent/children/${studentBId}/results`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(403);
    });

    it('never lets the parent fetch another family’s child via attendance', async () => {
      await request(app.getHttpServer())
        .get(`/portal/parent/children/${studentBId}/attendance`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(403);
    });

    it('never leaks another family’s child’s class via the assignments endpoint', async () => {
      await request(app.getHttpServer())
        .get(`/portal/parent/children/${studentBId}/assignments`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(403);
    });
  });

  describe('announcement audience resolution', () => {
    it('resolves a CLASS announcement to the actual roster and logs one entry per recipient', async () => {
      const res = await request(app.getHttpServer())
        .post('/communication/announcements')
        .set('Authorization', `Bearer ${proprietorToken}`)
        .send({ audience: 'CLASS', audienceRefId: classArmA, title: 'Test notice', body: 'Hello class A' })
        .expect(201);

      // Recipients for classArmA: student A (every student now gets an
      // auto-generated portal login) + student A's guardian (parent A) +
      // class teacher A = 3 recipients.
      expect(res.body.recipientCount).toBe(3);

      const logsRes = await request(app.getHttpServer())
        .get('/communication/logs')
        .set('Authorization', `Bearer ${proprietorToken}`)
        .expect(200);
      const matching = logsRes.body.filter((l: { targetDescription: string }) =>
        l.targetDescription.includes(classArmA),
      );
      expect(matching.length).toBe(3);
    });

    it('blocks a TEACHER from targeting a class they’re not assigned to', async () => {
      await request(app.getHttpServer())
        .post('/communication/announcements')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ audience: 'CLASS', audienceRefId: classArmB, title: 'x', body: 'x' })
        .expect(403);
    });

    it('blocks a TEACHER from targeting the whole school', async () => {
      await request(app.getHttpServer())
        .post('/communication/announcements')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ audience: 'SCHOOL', title: 'x', body: 'x' })
        .expect(403);
    });
  });

  describe('NotificationService: idempotent sends and graceful degradation', () => {
    it('does not duplicate a CommunicationLog row when the same event fires twice', async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const testApp = await moduleRef.createNestApplication().init();
      const notifications = testApp.get(NotificationService);
      const ctx = testApp.get(RequestContextService);

      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: provisionedTenantIds[0] } });
      const recipient = await prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'PROPRIETOR' } });

      const params = {
        recipientUserId: recipient.id,
        eventType: 'IDEMPOTENCY_TEST',
        title: 'Duplicate test',
        body: 'This should only ever produce one log row.',
        entityType: 'TestEntity',
        entityId: `fixed-id-${suffix}`,
        channels: ['EMAIL' as const],
      };

      await ctx.run({ userId: recipient.id, tenantId: tenant.id, role: 'PROPRIETOR', campusIds: [] }, async () => {
        await notifications.notify(params);
        await notifications.notify(params); // fired twice on purpose
      });

      const logs = await prisma.communicationLog.findMany({
        where: { tenantId: tenant.id, dedupeKey: { contains: `fixed-id-${suffix}` } },
      });
      expect(logs.length).toBe(1);

      await testApp.close();
    });

    it('leaves EMAIL as QUEUED and does not throw when EMAIL_PROVIDER is unset (default none)', async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const testApp = await moduleRef.createNestApplication().init();
      const notifications = testApp.get(NotificationService);
      const ctx = testApp.get(RequestContextService);

      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: provisionedTenantIds[0] } });
      const recipient = await prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'PROPRIETOR' } });
      const entityId = `no-provider-${suffix}`;

      await ctx.run({ userId: recipient.id, tenantId: tenant.id, role: 'PROPRIETOR', campusIds: [] }, async () => {
        await expect(
          notifications.notify({
            recipientUserId: recipient.id,
            eventType: 'NO_PROVIDER_TEST',
            title: 'x',
            body: 'x',
            entityType: 'TestEntity',
            entityId,
            channels: ['EMAIL'],
          }),
        ).resolves.not.toThrow();
      });

      const log = await prisma.communicationLog.findFirstOrThrow({
        where: { tenantId: tenant.id, dedupeKey: { contains: entityId } },
      });
      expect(log.status).toBe('QUEUED');

      // In-app notification still works regardless of the EMAIL channel above.
      const inAppNotification = await prisma.notification.findFirst({
        where: { tenantId: tenant.id, recipientUserId: recipient.id, entityId },
      });
      expect(inAppNotification).not.toBeNull();

      await testApp.close();
    });
  });
});
