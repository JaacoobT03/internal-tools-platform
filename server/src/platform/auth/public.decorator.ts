import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as explicitly public (no permission required).
 * Stub for now: the auth guard that reads this metadata lands with ADR 0001/0002.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
