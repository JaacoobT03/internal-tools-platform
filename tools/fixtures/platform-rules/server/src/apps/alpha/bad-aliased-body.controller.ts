import { Body as RequestBody, Controller, Post } from '@nestjs/common';
import * as nest from '@nestjs/common';

@Controller('alpha')
export class AlphaController {
  @Post()
  create(@RequestBody() body: unknown, @nest.Query() query: unknown) {
    return { body, query };
  }
}
