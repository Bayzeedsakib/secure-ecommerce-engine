import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { isUniqueViolation } from '../common/prisma-errors.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

export const BCRYPT_ROUNDS = 12;

// Compared against when the email is unknown, so a failed login takes the
// same time whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const publicUserFields = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register({
    name,
    email,
    password,
  }: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: { name, email, passwordHash },
        select: publicUserFields,
      });
      return this.issueToken(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login({ email, password }: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { id, name, role } = user;
    return this.issueToken({ id, name, email: user.email, role });
  }

  private async issueToken(user: AuthUser): Promise<AuthResponse> {
    const token = await this.jwt.signAsync({}, { subject: user.id });
    return { token, user };
  }
}
