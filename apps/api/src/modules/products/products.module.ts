import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { BarcodeLookupService } from './barcode-lookup.service';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, BarcodeLookupService],
  exports: [ProductsService],
})
export class ProductsModule {}
