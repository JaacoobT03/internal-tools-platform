import { applyDecorators, Header, SetMetadata } from '@nestjs/common';
import { RequirePermission } from '../auth/require-permission.decorator';

export const REVEAL_ENDPOINT_KEY = 'piiRevealEndpoint';
export const PII_REVEAL_HEADER = 'X-Pii-Reveal';

/**
 * Declares a PII reveal endpoint (ADR 0005): requires `permission` and marks
 * the response so the API test tripwire allows unmasked values here only.
 * The handler must return the value through PiiRevealService.reveal().
 */
export const RevealEndpoint = (permission: string) =>
  applyDecorators(
    RequirePermission(permission),
    SetMetadata(REVEAL_ENDPOINT_KEY, true),
    Header(PII_REVEAL_HEADER, 'true'),
  );
