import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { StockMovementsService } from './stock-movements.service';

// ADMIN e OPERATOR podem registrar e consultar movimentacoes: e a
// operacao do dia a dia da loja, nao uma acao administrativa.
@Controller({ path: 'stock-movements', version: '1' })
@UseGuards(JwtAuthGuard)
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Post()
  create(@Body() dto: CreateStockMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stockMovementsService.create(dto, user.userId);
  }

  @Get()
  findAll(@Query() query: ListStockMovementsQueryDto) {
    return this.stockMovementsService.findAll(query);
  }
}
