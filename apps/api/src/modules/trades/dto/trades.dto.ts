import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { OrderSide, OrderType } from '@prisma/client';

export class PlaceOrderDto {
  @IsString()
  symbol!: string;

  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  // Required for LIMIT / STOP_LIMIT; ignored for MARKET.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  stopPrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  takeProfit?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  stopLoss?: number;
}
