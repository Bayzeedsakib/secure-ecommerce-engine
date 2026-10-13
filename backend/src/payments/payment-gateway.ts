// The parts of Stripe the shop relies on. The orders module depends on this
// abstraction rather than on the Stripe SDK directly, so tests can swap in a
// fake gateway and never call the real Stripe API.

export interface CheckoutLineItem {
  name: string;
  unitAmountCents: number;
  quantity: number;
  imageUrl?: string;
}

export interface CreateCheckoutSessionInput {
  orderId: string;
  userId: string;
  customerEmail: string;
  currency: string;
  items: CheckoutLineItem[];
  expiresAt: Date;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionInfo {
  id: string;
  // open: waiting for payment, complete: customer finished, expired: no longer payable
  status: 'open' | 'complete' | 'expired';
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  paymentIntentId: string | null;
  orderId: string | null;
}

export type PaymentWebhookEvent =
  | {
      type:
        | 'checkout.session.completed'
        | 'checkout.session.async_payment_succeeded'
        | 'checkout.session.async_payment_failed'
        | 'checkout.session.expired';
      session: CheckoutSessionInfo;
    }
  | { type: 'ignored' };

export abstract class PaymentGateway {
  abstract createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<{ id: string; url: string }>;

  abstract retrieveCheckoutSession(
    sessionId: string,
  ): Promise<CheckoutSessionInfo>;

  abstract expireCheckoutSession(sessionId: string): Promise<void>;

  // The idempotency key makes a retried refund for the same order a no-op.
  abstract refundPayment(
    paymentIntentId: string,
    idempotencyKey: string,
  ): Promise<void>;

  // Verifies the webhook signature; throws if it is missing or invalid.
  abstract parseWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): PaymentWebhookEvent;
}
