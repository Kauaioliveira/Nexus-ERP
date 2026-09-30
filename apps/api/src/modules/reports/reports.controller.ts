import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OverviewQueryDto } from './dto/overview-query.dto';
import { ReportsService } from './reports.service';

@Controller({ path: 'reports', version: '1' })
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Operadores veem vendas e estoque; custo, lucro e margem so para ADMIN.
  @Get('overview')
  overview(@Query() query: OverviewQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.overview(query, user.role === Role.ADMIN);
  }
}
