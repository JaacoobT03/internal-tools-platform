import { Global, Module } from '@nestjs/common';
import { PiiRevealService } from './pii-reveal.service';

@Global()
@Module({
  providers: [PiiRevealService],
  exports: [PiiRevealService],
})
export class PiiModule {}
