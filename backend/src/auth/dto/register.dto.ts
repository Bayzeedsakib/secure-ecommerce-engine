import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim, TrimLowercase } from '../../common/transforms.js';

export class RegisterDto {
  /** @example "Ada Lovelace" */
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100)
  name: string;

  /** @example "ada@example.com" */
  @TrimLowercase()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(254)
  email: string;

  /**
   * bcrypt only uses the first 72 bytes of a password, so longer ones are rejected.
   * @example "correct-horse-battery"
   */
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must be at most 72 characters' })
  password: string;
}
