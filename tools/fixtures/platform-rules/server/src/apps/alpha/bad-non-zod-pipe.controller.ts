import { Body, Controller, ParseIntPipe, Post } from '@nestjs/common';

@Controller('alpha')
export class AlphaController {
  @Post()
  create(@Body('amount', ParseIntPipe) amount: number) {
    return { amount };
  }
}
