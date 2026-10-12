import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MAX_QUANTITY_PER_ITEM, type CartLineDto } from './dto/cart.dto.js';

export interface CartView {
  items: {
    product: {
      id: string;
      name: string;
      priceCents: number;
      imageUrl: string;
      stock: number;
    };
    quantity: number;
    lineTotalCents: number;
  }[];
  itemCount: number;
  subtotalCents: number;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string): Promise<CartView> {
    const rows = await this.prisma.cartItem.findMany({
      where: { userId, product: { active: true } },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    const items = rows.map(({ product, quantity }) => ({
      product: {
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        imageUrl: product.imageUrl,
        stock: product.stock,
      },
      quantity,
      lineTotalCents: product.priceCents * quantity,
    }));

    return {
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    };
  }

  async setQuantity(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartView> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, active: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (quantity > product.stock) {
      throw new ConflictException(
        product.stock === 0
          ? `"${product.name}" is out of stock`
          : `Only ${product.stock} of "${product.name}" left in stock`,
      );
    }

    await this.prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, quantity },
      update: { quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string): Promise<CartView> {
    await this.prisma.cartItem.deleteMany({ where: { userId, productId } });
    return this.getCart(userId);
  }

  async clear(userId: string): Promise<CartView> {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return this.getCart(userId);
  }

  // Adds a guest cart to the saved one. Quantities are combined and capped at
  // what is in stock; products that no longer exist or are sold out are skipped.
  async merge(userId: string, lines: CartLineDto[]): Promise<CartView> {
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const [products, existing] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds }, active: true },
      }),
      this.prisma.cartItem.findMany({
        where: { userId, productId: { in: productIds } },
      }),
    ]);

    const wanted = new Map(
      existing.map((item) => [item.productId, item.quantity]),
    );
    for (const line of lines) {
      wanted.set(
        line.productId,
        (wanted.get(line.productId) ?? 0) + line.quantity,
      );
    }

    await this.prisma.$transaction(
      products
        .map((product) => ({
          product,
          quantity: Math.min(
            wanted.get(product.id) ?? 0,
            product.stock,
            MAX_QUANTITY_PER_ITEM,
          ),
        }))
        .filter(({ quantity }) => quantity > 0)
        .map(({ product, quantity }) =>
          this.prisma.cartItem.upsert({
            where: { userId_productId: { userId, productId: product.id } },
            create: { userId, productId: product.id, quantity },
            update: { quantity },
          }),
        ),
    );

    return this.getCart(userId);
  }
}
