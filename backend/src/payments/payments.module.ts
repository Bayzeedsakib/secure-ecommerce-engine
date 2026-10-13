import { Module } from '@nestjs/common';
import { PaymentGateway } from './payment-gateway.js';
import { StripePaymentGateway } from './stripe-payment-gateway.js';

@Module({
  providers: [{ provide: PaymentGateway, useClass: StripePaymentGateway }],
  exports: [PaymentGateway],
})
export class PaymentsModule {}
