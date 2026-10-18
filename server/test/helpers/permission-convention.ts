import { INestApplicationContext } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../src/platform/auth/public.decorator';
import { REQUIRED_PERMISSION_KEY } from '../../src/platform/auth/require-permission.decorator';

export interface HandlerDeclaration {
  handler: string;
  declared: boolean;
}

/**
 * Lists every route handler of every controller registered in `context`
 * (ADR 0002) and whether it carries a handler-level @RequirePermission() or
 * @Public().
 */
export function scanHandlers(
  context: INestApplicationContext,
): HandlerDeclaration[] {
  const scanner = new MetadataScanner();
  const result: HandlerDeclaration[] = [];
  for (const module of context.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new () => object) | null;
      if (!controller) continue;
      const prototype = controller.prototype as Record<string, unknown>;
      for (const name of scanner.getAllMethodNames(prototype)) {
        const method = prototype[name] as object;
        if (Reflect.getMetadata(PATH_METADATA, method) === undefined) continue;
        result.push({
          handler: `${controller.name}.${name}`,
          declared:
            Reflect.getMetadata(IS_PUBLIC_KEY, method) === true ||
            typeof Reflect.getMetadata(REQUIRED_PERMISSION_KEY, method) ===
              'string',
        });
      }
    }
  }
  return result;
}

export function undeclaredHandlers(context: INestApplicationContext): string[] {
  return scanHandlers(context)
    .filter((entry) => !entry.declared)
    .map((entry) => entry.handler);
}
