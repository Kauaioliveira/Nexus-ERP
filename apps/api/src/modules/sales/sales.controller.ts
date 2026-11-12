import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FiscalService } from '../fiscal/fiscal.service';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { SalesService } from './sales.service';

// Registrar e consultar vendas e operacao do dia a dia (ADMIN e OPERATOR).
// Cancelar mexe em estoque e financeiro, entao fica com o ADMIN.
@Controller({ path: 'sales', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly fiscalService: FiscalService,
  ) {}

  @Post()
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.create(dto, user.userId);
  }

  @Get()
  findAll(@Query() query: ListSalesQueryDto) {
    return this.salesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOneOrThrow(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.cancel(id, dto, user.userId);
  }

  @Post(':id/fiscal/retry')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  retryFiscal(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.retryFiscalEmission(id);
  }

  // XML autorizado (nfeProc) e o do evento de cancelamento, para download.
  @Get(':id/fiscal/xml')
  async downloadXml(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { xml, fileName } = await this.fiscalService.getXml(id, 'nfe');
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return xml;
  }

  @Get(':id/fiscal/cancel-xml')
  async downloadCancelXml(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { xml, fileName } = await this.fiscalService.getXml(id, 'cancel');
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return xml;
  }
}
