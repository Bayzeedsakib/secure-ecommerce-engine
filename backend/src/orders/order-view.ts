import type { Prisma } from '../generated/prisma/client.js';

export const orderInclude = { items: { orderBy: { name: 'asc' } } } as const;

export type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

// The shape of an order in API responses (no internal Stripe ids).
export function toOrderView(order: OrderWithItems) {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    currency: order.currency,
    items: order.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      priceCents: item.priceCents,
      quantity: item.quantity,
    })),
    paidAt: order.paidAt,
    failureReason: order.failureReason,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
  };
}

export type OrderView = ReturnType<typeof toOrderView>;
