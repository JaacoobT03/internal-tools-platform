import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as explicitly public (no permission required). Public
 * endpoints are a short, code-owner-reviewed allowlist (ADR 0002).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
