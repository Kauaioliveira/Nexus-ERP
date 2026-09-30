import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateFinancialEntryDto } from './dto/create-financial-entry.dto';
import { FinancialSummaryQueryDto } from './dto/financial-summary-query.dto';
import { ListFinancialEntriesQueryDto } from './dto/list-financial-entries-query.dto';
import { PayFinancialEntryDto } from './dto/pay-financial-entry.dto';
import { UpdateFinancialEntryDto } from './dto/update-financial-entry.dto';
import { FinancialService } from './financial.service';

// Financeiro e area do dono/gerente: tudo restrito a ADMIN, inclusive a
// consulta (operador de caixa nao ve o caixa consolidado da empresa).
@Controller({ path: 'financial-entries', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Post()
  create(@Body() dto: CreateFinancialEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.financialService.create(dto, user.userId);
  }

  @Get()
  findAll(@Query() query: ListFinancialEntriesQueryDto) {
    return this.financialService.findAll(query);
  }

  // Declarada antes de ':id' para nao ser capturada como um id.
  @Get('summary')
  summary(@Query() query: FinancialSummaryQueryDto) {
    return this.financialService.summary(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.financialService.findOneOrThrow(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFinancialEntryDto) {
    return this.financialService.update(id, dto);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayFinancialEntryDto) {
    return this.financialService.pay(id, dto);
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@Param('id', ParseUUIDPipe) id: string) {
    return this.financialService.reopen(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.financialService.cancel(id);
  }
}
