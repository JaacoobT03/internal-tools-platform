import { Body, Controller, Post } from '@nestjs/common';

@Controller('fixture')
export class FixtureController {
  @Post()
  create(@Body() body: unknown) {
    return body;
  }
}
