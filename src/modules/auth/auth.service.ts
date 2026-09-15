import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { addDuration } from '../../common/utils/duration';
import { JwtAccessPayload } from './types/jwt-payload';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Runs entirely against PrismaService.raw: login/refresh/logout happen
 * before any tenant context exists (see PrismaService doc comment), and
 * User/RefreshToken lookups here are keyed by globally-unique fields
 * (email, tokenHash), not by tenant.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.raw.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // MFA schema exists (User.mfaEnabled/mfaSecret) but verification is a
    // later-phase UI per CLAUDE.md, not enforced at this layer yet.

    const campusIds = await this.campusIdsFor(user.id);
    const tokens = await this.issueTokenPair(user.id, user.tenantId, user.role, campusIds);

    await this.prisma.raw.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.raw.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.raw.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate on use: revoke the presented token, issue a fresh pair.
    await this.prisma.raw.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const campusIds = await this.campusIdsFor(user.id);
    return this.issueTokenPair(user.id, user.tenantId, user.role, campusIds);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.raw.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async campusIdsFor(userId: string): Promise<string[]> {
    const scopes = await this.prisma.raw.userCampusScope.findMany({
      where: { userId },
      select: { campusId: true },
    });
    return scopes.map((s) => s.campusId);
  }

  private async issueTokenPair(
    userId: string,
    tenantId: string | null,
    role: JwtAccessPayload['role'],
    campusIds: string[],
  ): Promise<TokenPair> {
    const accessPayload: JwtAccessPayload = { sub: userId, tenantId, role, campusIds };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    );

    await this.prisma.raw.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: addDuration(new Date(), refreshExpiresIn),
      },
    });

    return { accessToken, refreshToken };
  }

  /** Refresh tokens are already high-entropy signed JWTs, not user-chosen
   * secrets: SHA-256 is the right tool for a lookup/revocation key here,
   * bcrypt is reserved for the low-entropy User.passwordHash. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
