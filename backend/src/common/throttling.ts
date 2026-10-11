import { SetMetadata, type ExecutionContext } from '@nestjs/common';

const AUTH_RATE_LIMITED_KEY = 'authRateLimited';

// Marks login/register so they also count against the stricter "auth" limit,
// which slows down password guessing.
export const AuthRateLimited = () => SetMetadata(AUTH_RATE_LIMITED_KEY, true);

export function isAuthRateLimited(context: ExecutionContext): boolean {
  return (
    Reflect.getMetadata(AUTH_RATE_LIMITED_KEY, context.getHandler()) === true
  );
}
