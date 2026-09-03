import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * The two suites CLAUDE.md calls out as mattering most at this stage:
 * tenant isolation (a user from tenant A can never read tenant B's data)
 * and permission regression (each role gets an allow/deny check against a
 * real endpoint) — plus a couple of state-machine ordering checks since
 * they're cheap to add once the app is already booted.
 *
 * Self-contained: creates its own SUPER_ADMIN and two fresh tenants per
 * run (unique email/slug suffix) rather than depending on `npm run seed`
 * having been run first.
 */
describe('Tenant isolation & RBAC (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = Date.now();
  const PASSWORD = 'Password123!';

  let superAdminToken: string;
  let tenantAProprietorToken: string;
  let tenantBProprietorToken: string;
  let tenantATeacherToken: string;
  let tenantAStudentId: string;
  let superAdminUserId: string;
  const provisionedTenantIds: string[] = [];

  async function login(email: string, password = PASSWORD): Promise<string> {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const superAdminEmail = `e2e-superadmin-${suffix}@schoolos.dev`;
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        tenantId: null,
        role: 'SUPER_ADMIN',
        firstName: 'E2E',
        lastName: 'SuperAdmin',
        passwordHash,
      },
    });
    superAdminUserId = superAdmin.id;
    superAdminToken = await login(superAdminEmail);

    const tenantA = await provisionTenant('a');
    const tenantB = await provisionTenant('b');
    tenantAProprietorToken = tenantA.proprietorToken;
    tenantBProprietorToken = tenantB.proprietorToken;

    // A teacher inside tenant A, created by tenant A's proprietor.
    const teacherEmail = `teacher-a-${suffix}@test.dev`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${tenantAProprietorToken}`)
      .send({ email: teacherEmail, password: PASSWORD, firstName: 'T', lastName: 'Eacher', role: 'TEACHER' })
      .expect(201);
    tenantATeacherToken = await login(teacherEmail);

    // A student inside tenant A, owned by tenant A's proprietor.
    const campusesRes = await request(app.getHttpServer())
      .get('/campuses')
      .set('Authorization', `Bearer ${tenantAProprietorToken}`)
      .expect(200);
    const campusId = campusesRes.body[0].id;

    const studentRes = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${tenantAProprietorToken}`)
      .send({ campusId, firstName: 'Isolated', lastName: 'Student' })
      .expect(201);
    tenantAStudentId = studentRes.body.id;

    async function provisionTenant(label: string) {
      const slug = `e2e-tenant-${label}-${suffix}`;
      const email = `prop-${label}-${suffix}@test.dev`;
      const res = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: `E2E Tenant ${label.toUpperCase()} ${suffix}`,
          slug,
          campusName: 'Main Campus',
          proprietor: { email, password: PASSWORD, firstName: 'Prop', lastName: label.toUpperCase() },
        })
        .expect(201);
      provisionedTenantIds.push(res.body.tenant.id);
      return { proprietorToken: await login(email) };
    }
  }, 30000);

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: provisionedTenantIds } } });
    await prisma.user.delete({ where: { id: superAdminUserId } }).catch(() => undefined);
    await prisma.$disconnect();
    await app.close();
  });

  describe('tenant isolation', () => {
    it('lets tenant A see the student it created', async () => {
      const res = await request(app.getHttpServer())
        .get('/students')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).toContain(tenantAStudentId);
    });

    it('never lets tenant B see tenant A’s student via list', async () => {
      const res = await request(app.getHttpServer())
        .get('/students')
        .set('Authorization', `Bearer ${tenantBProprietorToken}`)
        .expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).not.toContain(tenantAStudentId);
    });

    it('never lets tenant B fetch tenant A’s student directly by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${tenantAStudentId}`)
        .set('Authorization', `Bearer ${tenantBProprietorToken}`);
      expect(res.status).not.toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('Isolated');
    });

    it('SUPER_ADMIN has no default access to a tenant’s student data', async () => {
      const res = await request(app.getHttpServer())
        .get('/students')
        .set('Authorization', `Bearer ${superAdminToken}`);
      // No tenant context for SUPER_ADMIN — the tenant-scoping extension
      // rejects the query outright rather than silently returning nothing.
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('permission regression (deny by default)', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/students').expect(401);
    });

    it('lets PROPRIETOR create a student', async () => {
      const campusesRes = await request(app.getHttpServer())
        .get('/campuses')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .post('/students')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .send({ campusId: campusesRes.body[0].id, firstName: 'Second', lastName: 'Student' })
        .expect(201);
    });

    it('blocks TEACHER from creating a student', async () => {
      await request(app.getHttpServer())
        .post('/students')
        .set('Authorization', `Bearer ${tenantATeacherToken}`)
        .send({ campusId: 'irrelevant', firstName: 'X', lastName: 'Y' })
        .expect(403);
    });

    it('blocks a tenant PROPRIETOR from the SUPER_ADMIN-only tenants endpoint', async () => {
      await request(app.getHttpServer())
        .get('/tenants')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .expect(403);
    });

    it('blocks TEACHER from provisioning tenants', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${tenantATeacherToken}`)
        .send({ name: 'x', slug: 'x', campusName: 'x', proprietor: { email: 'x@x.com', password: 'x', firstName: 'x', lastName: 'x' } })
        .expect(403);
    });
  });

  describe('result state machine', () => {
    it('rejects approving a result that is still DRAFT', async () => {
      const campusesRes = await request(app.getHttpServer())
        .get('/campuses')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .expect(200);
      const campusId = campusesRes.body[0].id;

      const subjectRes = await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .send({ name: `Subject ${suffix}` })
        .expect(201);

      const classRes = await request(app.getHttpServer())
        .post('/classes')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .send({ campusId, name: `Class ${suffix}` })
        .expect(201);

      const armRes = await request(app.getHttpServer())
        .post('/class-arms')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .send({ schoolClassId: classRes.body.id, name: 'A' })
        .expect(201);

      const studentRes = await request(app.getHttpServer())
        .post('/students')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .send({
          campusId,
          firstName: 'Result',
          lastName: 'Subject',
          currentClassArmId: armRes.body.id,
        })
        .expect(201);

      const sessionRes = await request(app.getHttpServer())
        .post('/academic-sessions')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .send({ name: `Session ${suffix}`, startDate: '2025-09-01', endDate: '2026-07-01' })
        .expect(201);

      const termRes = await request(app.getHttpServer())
        .post('/terms')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .send({
          academicSessionId: sessionRes.body.id,
          name: 'FIRST',
          startDate: '2025-09-01',
          endDate: '2025-12-01',
        })
        .expect(201);

      const resultRes = await request(app.getHttpServer())
        .post('/results')
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .send({
          studentId: studentRes.body.id,
          subjectId: subjectRes.body.id,
          academicSessionId: sessionRes.body.id,
          termId: termRes.body.id,
          continuousAssessmentScore: 30,
          examScore: 55,
        })
        .expect(201);

      expect(resultRes.body.status).toBe('DRAFT');

      await request(app.getHttpServer())
        .patch(`/results/${resultRes.body.id}/approve`)
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .expect(409);

      await request(app.getHttpServer())
        .patch(`/results/${resultRes.body.id}/submit`)
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/results/${resultRes.body.id}/approve`)
        .set('Authorization', `Bearer ${tenantAProprietorToken}`)
        .expect(200);
    });
  });
});
