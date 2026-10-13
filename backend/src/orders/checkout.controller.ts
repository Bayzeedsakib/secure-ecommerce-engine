import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('checkout')
@ApiBearerAuth()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly orders: OrdersService) {}

  /** Creates a pending order from the cart and returns the Stripe Checkout URL. */
  @Post()
  start(@CurrentUser() user: AuthUser) {
    return this.orders.startCheckout(user);
  }

  /** Verifies the payment with Stripe and, if paid, deducts stock. Safe to call repeatedly. */
  @HttpCode(200)
  @Post('confirm')
  confirm(@CurrentUser() user: AuthUser, @Body() dto: ConfirmCheckoutDto) {
    return this.orders.confirmCheckout(user, dto.sessionId);
  }

  /** Cancels a pending order and expires its Stripe session. */
  @HttpCode(200)
  @Post(':orderId/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.cancelCheckout(user, orderId);
  }
}
