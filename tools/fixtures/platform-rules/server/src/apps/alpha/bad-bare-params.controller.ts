import { Body, Controller, Param, Post, Query } from '@nestjs/common';

@Controller('alpha')
export class AlphaController {
  @Post(':id')
  create(
    @Param('id') id: string,
    @Query() query: unknown,
    @Body() body: unknown,
  ) {
    return { id, query, body };
  }
}
