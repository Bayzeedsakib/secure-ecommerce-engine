import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimLowercase } from '../../common/transforms.js';

export class LoginDto {
  /** @example "ada@example.com" */
  @TrimLowercase()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(254)
  email: string;

  /** @example "correct-horse-battery" */
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MaxLength(72)
  password: string;
}
