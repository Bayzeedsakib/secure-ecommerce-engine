import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { OrderStatus } from '../generated/prisma/enums.js';
import { PaymentGateway } from '../payments/payment-gateway.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { FulfillmentService } from './fulfillment.service.js';
import {
  orderInclude,
  toOrderView,
  type OrderWithItems,
} from './order-view.js';

// Stripe rejects sessions that expire less than 30 minutes from "now" on its
// side, so a little slack covers the time the request spends in flight.
const EXPIRY_SLACK_MS = 60_000;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly payments: PaymentGateway,
    private readonly fulfillment: FulfillmentService,
  ) {}

  // Turns the user's cart into a PENDING order and a Stripe Checkout Session.
  // Prices and stock always come from the database, never from the client.
  async startCheckout(user: AuthUser) {
    const cart = await this.prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    if (cart.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    for (const { product, quantity } of cart) {
      if (!product.active) {
        throw new ConflictException(`"${product.name}" is no longer available`);
      }
      if (quantity > product.stock) {
        throw new ConflictException(
          product.stock === 0
            ? `"${product.name}" is out of stock`
            : `Only ${product.stock} of "${product.name}" left in stock`,
        );
      }
    }

    const expiresAt = new Date(
      Date.now() +
        this.config.checkoutExpiresMinutes * 60_000 +
        EXPIRY_SLACK_MS,
    );

    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        currency: this.config.currency,
        totalCents: cart.reduce(
          (sum, { product, quantity }) => sum + product.priceCents * quantity,
          0,
        ),
        expiresAt,
        items: {
          create: cart.map(({ product, quantity }) => ({
            productId: product.id,
            name: product.name,
            priceCents: product.priceCents,
            quantity,
          })),
        },
      },
    });

    let session: { id: string; url: string };
    try {
      session = await this.payments.createCheckoutSession({
        orderId: order.id,
        userId: user.id,
        customerEmail: user.email,
        currency: this.config.currency,
        items: cart.map(({ product, quantity }) => ({
          name: product.name,
          unitAmountCents: product.priceCents,
          quantity,
          imageUrl: product.imageUrl || undefined,
        })),
        expiresAt,
        successUrl: `${this.config.clientUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${this.config.clientUrl}/checkout/cancel?order_id=${order.id}`,
      });
    } catch (error) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          failureReason: 'The payment could not be started',
        },
      });
      throw error;
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return { orderId: order.id, checkoutUrl: session.url };
  }

  // Called by the success page. Asks Stripe directly whether the session was
  // paid, so it works even when webhooks are not set up.
  async confirmCheckout(user: AuthUser, sessionId: string) {
    const order = await this.prisma.order.findFirst({
      where: { stripeSessionId: sessionId, userId: user.id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const session = await this.payments.retrieveCheckoutSession(sessionId);
    return toOrderView(await this.fulfillment.handlePaidSession(session));
  }

  // Called when the customer clicks "back" on the Stripe page.
  async cancelCheckout(user: AuthUser, orderId: string) {
    const order = await this.findOwned(user.id, orderId);

    if (order.status !== OrderStatus.PENDING || !order.stripeSessionId) {
      return toOrderView(order);
    }

    const session = await this.payments.retrieveCheckoutSession(
      order.stripeSessionId,
    );

    // The customer may have paid in another tab before cancelling here.
    if (session.paymentStatus === 'paid') {
      return toOrderView(await this.fulfillment.handlePaidSession(session));
    }

    if (session.status === 'open') {
      // Expiring the session makes sure it can no longer be paid.
      await this.payments.expireCheckoutSession(session.id);
    }

    await this.fulfillment.markCancelled(session.id, 'Checkout was cancelled');
    return toOrderView(await this.findOwned(user.id, orderId));
  }

  async listForUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });

    const refreshed = await Promise.all(
      orders.map((order) => this.reconcile(order)),
    );
    return refreshed.map(toOrderView);
  }

  async getForUser(userId: string, orderId: string) {
    return toOrderView(
      await this.reconcile(await this.findOwned(userId, orderId)),
    );
  }

  async listAll() {
    const orders = await this.prisma.order.findMany({
      include: {
        ...orderInclude,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return orders.map((order) => ({
      ...toOrderView(order),
      customer: order.user,
    }));
  }

  // A PENDING order may already be paid or expired on Stripe's side if the
  // customer closed the tab and no webhook arrived. Checking with Stripe when
  // the order is viewed keeps the order and the stock correct without a webhook.
  private async reconcile(order: OrderWithItems): Promise<OrderWithItems> {
    if (order.status !== OrderStatus.PENDING || !order.stripeSessionId) {
      return order;
    }

    try {
      const session = await this.payments.retrieveCheckoutSession(
        order.stripeSessionId,
      );

      if (session.paymentStatus === 'paid') {
        return await this.fulfillment.handlePaidSession(session);
      }
      if (session.status === 'expired') {
        await this.fulfillment.markCancelled(
          session.id,
          'Checkout session expired',
        );
        return await this.findOwned(order.userId, order.id);
      }
    } catch (error) {
      // Stripe being unreachable must not break the order list.
      this.logger.warn(
        `Could not refresh order ${order.id}: ${(error as Error).message}`,
      );
    }

    return order;
  }

  private async findOwned(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}
