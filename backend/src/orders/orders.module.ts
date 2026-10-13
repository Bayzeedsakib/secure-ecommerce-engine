import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { CheckoutController } from './checkout.controller.js';
import { FulfillmentService } from './fulfillment.service.js';
import {
  AdminOrdersController,
  OrdersController,
} from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';

@Module({
  imports: [PaymentsModule],
  controllers: [
    CheckoutController,
    OrdersController,
    AdminOrdersController,
    StripeWebhookController,
  ],
  providers: [OrdersService, FulfillmentService],
})
export class OrdersModule {}
