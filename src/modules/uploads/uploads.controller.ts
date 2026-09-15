import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { RequestContextService } from '../../common/context/request-context';
import { UploadsService } from './uploads.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']);

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly requestContext: RequestContextService,
  ) {}

  // Logo upload only, for now — the one place in the app (tenant branding)
  // that currently makes do with a pasted image URL. Student/staff photo
  // upload can reuse UploadsService the same way once that feature exists.
  @Roles('PROPRIETOR')
  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Logo must be a PNG, JPEG, WEBP, or SVG image');
    }
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('No tenant context');
    return this.uploads.uploadImage(file.buffer, `schoolos/${tenantId}/branding`);
  }
}
