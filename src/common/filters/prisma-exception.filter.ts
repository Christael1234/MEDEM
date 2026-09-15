import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Every service in this codebase leans on findUniqueOrThrow/delete/update
 * assuming a bad id turns into a clean 404, but nothing was ever
 * registered to actually translate Prisma's own "not found"
 * (PrismaClientKnownRequestError code P2025) into one, so it fell through
 * to Nest's default handler as a raw, unhelpful 500 everywhere. Only the
 * handful of codes services actually rely on are mapped; anything else
 * still surfaces as 500: an unmapped Prisma error is more likely a real
 * bug than something safe to relabel as a 400.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = this.mapException(exception);

    if (!mapped) {
      response.status(500).json({ statusCode: 500, message: 'Internal server error' });
      return;
    }

    response.status(mapped.getStatus()).json(mapped.getResponse());
  }

  private mapException(exception: Prisma.PrismaClientKnownRequestError): HttpException | null {
    switch (exception.code) {
      case 'P2025':
        return new NotFoundException('Record not found');
      case 'P2002': {
        const target = Array.isArray(exception.meta?.target) ? exception.meta.target.join(', ') : 'field';
        return new ConflictException(`A record with this ${target} already exists`);
      }
      case 'P2003':
        return new BadRequestException('This operation references a record that does not exist');
      default:
        return null;
    }
  }
}
