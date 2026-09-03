import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestContextService } from './request-context';
import { TenantContextInterceptor } from './tenant-context.interceptor';

/**
 * Global module: makes RequestContextService injectable anywhere and wires
 * TenantContextInterceptor into every request.
 */
@Global()
@Module({
  providers: [
    RequestContextService,
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [RequestContextService],
})
export class ContextModule {}
