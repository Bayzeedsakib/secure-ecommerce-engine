import {
  PaymentGateway,
  type CheckoutSessionInfo,
  type CreateCheckoutSessionInput,
  type PaymentWebhookEvent,
} from '../../src/payments/payment-gateway.js';

export const VALID_SIGNATURE = 'valid-test-signature';

// In-memory stand-in for Stripe. Tests drive it with pay() and expire() to
// simulate what a customer does on the Stripe checkout page.
export class FakePaymentGateway extends PaymentGateway {
  readonly sessions = new Map<string, CheckoutSessionInfo>();
  readonly createdSessions: CreateCheckoutSessionInput[] = [];
  readonly refunds: { paymentIntentId: string; idempotencyKey: string }[] = [];
  failNextCreate = false;
  private counter = 0;

  async createCheckoutSession(input: CreateCheckoutSessionInput) {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new Error('Stripe is unavailable');
    }

    this.counter += 1;
    const id = `cs_test_fake${this.counter}`;
    this.createdSessions.push(input);
    this.sessions.set(id, {
      id,
      status: 'open',
      paymentStatus: 'unpaid',
      paymentIntentId: null,
      orderId: input.orderId,
    });
    return { id, url: `https://checkout.stripe.test/${id}` };
  }

  async retrieveCheckoutSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No such checkout session: ${sessionId}`);
    }
    return { ...session };
  }

  async expireCheckoutSession(sessionId: string) {
    this.update(sessionId, { status: 'expired' });
  }

  async refundPayment(paymentIntentId: string, idempotencyKey: string) {
    // Mirrors Stripe idempotency: the same key never refunds twice.
    if (
      !this.refunds.some((refund) => refund.idempotencyKey === idempotencyKey)
    ) {
      this.refunds.push({ paymentIntentId, idempotencyKey });
    }
  }

  parseWebhookEvent(rawBody: Buffer, signature: string): PaymentWebhookEvent {
    if (signature !== VALID_SIGNATURE) {
      throw new Error('Invalid signature');
    }
    return JSON.parse(rawBody.toString('utf8')) as PaymentWebhookEvent;
  }

  // Simulates the customer completing payment on the Stripe page.
  pay(sessionId: string): CheckoutSessionInfo {
    return this.update(sessionId, {
      status: 'complete',
      paymentStatus: 'paid',
      paymentIntentId: `pi_test_${sessionId}`,
    });
  }

  lastSessionId(): string {
    return [...this.sessions.keys()].at(-1)!;
  }

  private update(sessionId: string, changes: Partial<CheckoutSessionInfo>) {
    const session = { ...this.sessions.get(sessionId)!, ...changes };
    this.sessions.set(sessionId, session);
    return session;
  }
}
