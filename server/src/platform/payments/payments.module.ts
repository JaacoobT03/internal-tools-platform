import { Global, Module } from '@nestjs/common';
import { assertMockAllowed } from '../runtime/mock-guard';
import { MockPaymentsAdapter } from './mock-payments.adapter';
import { PAYMENTS_ADAPTER } from './payments-adapter';

@Global()
@Module({
  providers: [
    {
      provide: PAYMENTS_ADAPTER,
      useFactory: () => {
        assertMockAllowed('Mock payments adapter');
        return new MockPaymentsAdapter();
      },
    },
  ],
  exports: [PAYMENTS_ADAPTER],
})
export class PaymentsModule {}
