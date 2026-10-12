import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isNotFound } from '../common/prisma-errors.js';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findActive(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, active: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  listAll() {
    return this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async update(id: string, dto: UpdateProductDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    try {
      return await this.prisma.product.update({ where: { id }, data: dto });
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundException('Product not found');
      }
      throw error;
    }
  }

  // Products are archived rather than deleted: past orders still point to
  // them. Archived products disappear from the shop and from carts.
  async archive(id: string) {
    const product = await this.update(id, { active: false });
    await this.prisma.cartItem.deleteMany({ where: { productId: id } });
    return product;
  }
}
