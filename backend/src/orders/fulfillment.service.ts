import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderStatus } from '../generated/prisma/enums.js';
import {
  PaymentGateway,
  type CheckoutSessionInfo,
} from '../payments/payment-gateway.js';
import { orderInclude, type OrderWithItems } from './order-view.js';

class OutOfStockError extends Error {
  constructor(readonly productName: string) {
    super(`"${productName}" sold out before the payment completed`);
  }
}

// Moves orders out of PENDING once Stripe reports the outcome. Every method is
// idempotent: the success page and the webhook may both report the same
// payment, possibly at the same moment, and stock must only move once.
@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentGateway,
  ) {}

  async handlePaidSession(
    session: CheckoutSessionInfo,
  ): Promise<OrderWithItems> {
    const orderId = this.orderIdOf(session);

    if (session.paymentStatus !== 'paid') {
      return this.findBySession(session.id);
    }

    try {
      return await this.deductStockAndMarkPaid(orderId, session);
    } catch (error) {
      if (!(error instanceof OutOfStockError)) {
        throw error;
      }
      return this.refundUnfulfillableOrder(orderId, session, error.message);
    }
  }

  async markCancelled(sessionId: string, reason: string): Promise<void> {
    await this.prisma.order.updateMany({
      where: { stripeSessionId: sessionId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.CANCELLED, failureReason: reason },
    });
  }

  // All stock changes for an order happen in one transaction: either every
  // item is deducted and the order becomes PAID, or nothing changes.
  private deductStockAndMarkPaid(
    orderId: string,
    session: CheckoutSessionInfo,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Locking the order row makes concurrent confirmations of the same
      // payment run one after another; the second one sees PAID and stops.
      const [locked] = await tx.$queryRaw<
        { status: OrderStatus; userId: string }[]
      >`
        SELECT "status", "userId" FROM "orders"
        WHERE "id" = ${orderId}::uuid AND "stripeSessionId" = ${session.id}
        FOR UPDATE`;

      if (!locked) {
        throw new NotFoundException('Order not found');
      }
      if (
        locked.status === OrderStatus.PAID ||
        locked.status === OrderStatus.REFUNDED
      ) {
        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: orderInclude,
        });
      }

      // Sorted so concurrent orders lock products in the same order and
      // cannot deadlock each other.
      const items = await tx.orderItem.findMany({
        where: { orderId },
        orderBy: { productId: 'asc' },
      });

      for (const item of items) {
        // The stock check and the decrement are a single atomic statement,
        // so two buyers can never both take the last unit.
        const { count } = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });

        if (count === 0) {
          throw new OutOfStockError(item.name);
        }
      }

      await tx.cartItem.deleteMany({
        where: {
          userId: locked.userId,
          productId: { in: items.map((item) => item.productId) },
        },
      });

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          stripePaymentIntentId: session.paymentIntentId,
          failureReason: null,
        },
        include: orderInclude,
      });
    });
  }

  private async refundUnfulfillableOrder(
    orderId: string,
    session: CheckoutSessionInfo,
    reason: string,
  ): Promise<OrderWithItems> {
    this.logger.warn(`Refunding order ${orderId}: ${reason}`);

    if (session.paymentIntentId) {
      await this.payments.refundPayment(
        session.paymentIntentId,
        `refund-order-${orderId}`,
      );
    }

    await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: { in: [OrderStatus.PENDING, OrderStatus.CANCELLED] },
      },
      data: {
        status: OrderStatus.REFUNDED,
        stripePaymentIntentId: session.paymentIntentId,
        failureReason: `${reason}. Your payment has been refunded.`,
      },
    });

    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
  }

  private orderIdOf(session: CheckoutSessionInfo): string {
    if (!session.orderId) {
      throw new NotFoundException(
        'This checkout session does not belong to an order',
      );
    }
    return session.orderId;
  }

  private async findBySession(sessionId: string) {
    const order = await this.prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}
