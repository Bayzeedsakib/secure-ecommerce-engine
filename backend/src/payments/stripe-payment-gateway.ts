import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { AppConfigService } from '../config/app-config.service.js';
import {
  PaymentGateway,
  type CheckoutSessionInfo,
  type CreateCheckoutSessionInput,
  type PaymentWebhookEvent,
} from './payment-gateway.js';

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

@Injectable()
export class StripePaymentGateway extends PaymentGateway {
  private readonly stripe: Stripe;

  constructor(private readonly config: AppConfigService) {
    super();
    this.stripe = new Stripe(config.stripeSecretKey, { maxNetworkRetries: 2 });
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput) {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: input.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: input.currency,
            unit_amount: item.unitAmountCents,
            product_data: {
              name: item.name,
              ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
            },
          },
        })),
        customer_email: input.customerEmail,
        client_reference_id: input.userId,
        metadata: { orderId: input.orderId },
        payment_intent_data: { metadata: { orderId: input.orderId } },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
      },
      // A retried request for the same order returns the same session
      // instead of creating a second one.
      { idempotencyKey: `checkout-${input.orderId}` },
    );

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    return { id: session.id, url: session.url };
  }

  async retrieveCheckoutSession(sessionId: string) {
    return toSessionInfo(
      await this.stripe.checkout.sessions.retrieve(sessionId),
    );
  }

  async expireCheckoutSession(sessionId: string) {
    await this.stripe.checkout.sessions.expire(sessionId);
  }

  async refundPayment(paymentIntentId: string, idempotencyKey: string) {
    await this.stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey },
    );
  }

  parseWebhookEvent(rawBody: Buffer, signature: string): PaymentWebhookEvent {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.config.stripeWebhookSecret,
    );

    if (!HANDLED_EVENTS.has(event.type)) {
      return { type: 'ignored' };
    }

    return {
      type: event.type as Exclude<PaymentWebhookEvent['type'], 'ignored'>,
      session: toSessionInfo(event.data.object as Stripe.Checkout.Session),
    };
  }
}

const SESSION_STATUSES = ['open', 'complete', 'expired'] as const;
const PAYMENT_STATUSES = ['paid', 'unpaid', 'no_payment_required'] as const;

// Stripe may add new values over time; anything unknown is treated as "not
// paid yet", which never deducts stock by mistake.
function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function toSessionInfo(session: Stripe.Checkout.Session): CheckoutSessionInfo {
  const paymentIntent = session.payment_intent;

  return {
    id: session.id,
    status: oneOf(SESSION_STATUSES, session.status, 'open'),
    paymentStatus: oneOf(PAYMENT_STATUSES, session.payment_status, 'unpaid'),
    paymentIntentId:
      typeof paymentIntent === 'string'
        ? paymentIntent
        : (paymentIntent?.id ?? null),
    orderId: session.metadata?.orderId ?? null,
  };
}
