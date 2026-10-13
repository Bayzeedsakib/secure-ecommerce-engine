import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import {
  PaymentGateway,
  type PaymentWebhookEvent,
} from '../payments/payment-gateway.js';
import { FulfillmentService } from './fulfillment.service.js';

// Optional. Stripe calls this when a payment finishes even if the customer
// never comes back to the success page. Requests are trusted only after their
// signature has been verified with STRIPE_WEBHOOK_SECRET.
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly config: AppConfigService,
    private readonly payments: PaymentGateway,
    private readonly fulfillment: FulfillmentService,
  ) {}

  @HttpCode(200)
  @Post()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!this.config.stripeWebhookSecret) {
      throw new NotFoundException('Stripe webhooks are not configured');
    }
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing Stripe signature');
    }

    let event: PaymentWebhookEvent;
    try {
      event = this.payments.parseWebhookEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (event.session.paymentStatus === 'paid') {
          await this.fulfillment.handlePaidSession(event.session);
        }
        break;
      case 'checkout.session.async_payment_failed':
        await this.fulfillment.markCancelled(
          event.session.id,
          'The payment failed',
        );
        break;
      case 'checkout.session.expired':
        await this.fulfillment.markCancelled(
          event.session.id,
          'Checkout session expired',
        );
        break;
    }

    return { received: true };
  }
}
