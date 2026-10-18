// Platform ESLint rules. Each rule is proven to fail on deliberate violations
// by a test in tools/ (see tools/eslint-platform-rules.test.cjs).

// ADR 0006: payment provider SDKs may only be imported by the payments adapter.
export const PAYMENT_SDK_MODULES = [
  'stripe',
  '@stripe/*',
  'braintree',
  '@braintree/*',
  '@adyen/*',
  '@paypal/*',
  'paypal-rest-sdk',
  '@mollie/*',
  'mollie-api-node',
  'square',
  '@square/*',
  'razorpay',
  'checkout-sdk-node',
  '@checkout.com/*',
  '@klarna/*',
  'gocardless-nodejs',
];

function isPaymentSdk(source) {
  return PAYMENT_SDK_MODULES.some((module) => {
    if (module.endsWith('/*')) return source.startsWith(module.slice(0, -1));
    return source === module || source.startsWith(`${module}/`);
  });
}

const noPaymentSdkImport = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Payment provider SDKs may only be imported in server/src/platform/payments/ (ADR 0006).',
    },
    schema: [],
    messages: {
      forbidden:
        "'{{source}}' is a payment provider SDK. Use the platform PaymentsAdapter (server/src/platform/payments/) instead (ADR 0006).",
    },
  },
  create(context) {
    function check(node) {
      if (
        node &&
        node.type === 'Literal' &&
        typeof node.value === 'string' &&
        isPaymentSdk(node.value)
      ) {
        context.report({
          node,
          messageId: 'forbidden',
          data: { source: node.value },
        });
      }
    }
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      TSExternalModuleReference: (node) => check(node.expression),
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require'
        ) {
          check(node.arguments[0]);
        }
      },
    };
  },
};

// Input validation: @Body(), @Query() and @Param() from @nestjs/common must
// be given a `new ZodValidationPipe(schema)` argument.
const PARAM_DECORATORS = new Set(['Body', 'Query', 'Param']);

function isZodPipe(node) {
  return (
    node.type === 'NewExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'ZodValidationPipe'
  );
}

const validatedRequestInput = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '@Body(), @Query() and @Param() must pass a ZodValidationPipe.',
    },
    schema: [],
    messages: {
      missingPipe:
        '@{{name}}() must pass a ZodValidationPipe, e.g. @{{name}}(new ZodValidationPipe(schema)) (server/src/platform/validation/).',
    },
  },
  create(context) {
    const localNames = new Map();
    return {
      ImportDeclaration(node) {
        if (node.source.value !== '@nestjs/common') return;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') {
            localNames.set(specifier.local.name, '*');
          } else if (
            specifier.type === 'ImportSpecifier' &&
            PARAM_DECORATORS.has(specifier.imported.name)
          ) {
            localNames.set(specifier.local.name, specifier.imported.name);
          }
        }
      },
      Decorator(node) {
        const expression = node.expression;
        const callee =
          expression.type === 'CallExpression' ? expression.callee : expression;
        let name;
        if (
          callee.type === 'Identifier' &&
          localNames.get(callee.name) !== '*'
        ) {
          name = localNames.get(callee.name);
        } else if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          localNames.get(callee.object.name) === '*' &&
          callee.property.type === 'Identifier' &&
          PARAM_DECORATORS.has(callee.property.name)
        ) {
          name = callee.property.name;
        }
        if (!name) return;
        const args =
          expression.type === 'CallExpression' ? expression.arguments : [];
        if (!args.some(isZodPipe)) {
          context.report({ node, messageId: 'missingPipe', data: { name } });
        }
      },
    };
  },
};

export default {
  meta: { name: 'eslint-plugin-platform' },
  rules: {
    'no-payment-sdk-import': noPaymentSdkImport,
    'validated-request-input': validatedRequestInput,
  },
};
