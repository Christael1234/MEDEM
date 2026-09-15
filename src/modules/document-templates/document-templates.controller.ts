import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { DocumentTemplatesService } from './document-templates.service';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly documentTemplatesService: DocumentTemplatesService) {}

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Get()
  list() {
    return this.documentTemplatesService.list();
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Get(':id/preview')
  preview(@Param('id') id: string) {
    return this.documentTemplatesService.preview(id);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentTemplateDto) {
    return this.documentTemplatesService.update(id, dto);
  }

  @Roles('PROPRIETOR')
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.documentTemplatesService.publish(id);
  }
}
