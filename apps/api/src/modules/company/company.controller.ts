import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyService } from './company.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

// Dados do emitente: qualquer usuario le (o DANFE precisa), so o ADMIN altera.
@Controller({ path: 'company-settings', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.getPublic(user.role === Role.ADMIN);
  }

  @Patch()
  @Roles(Role.ADMIN)
  update(@Body() dto: UpdateCompanySettingsDto) {
    return this.companyService.update(dto);
  }
}
