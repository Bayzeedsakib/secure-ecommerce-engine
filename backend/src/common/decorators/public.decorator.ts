import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Every route requires a valid JWT unless it is marked @Public().
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
