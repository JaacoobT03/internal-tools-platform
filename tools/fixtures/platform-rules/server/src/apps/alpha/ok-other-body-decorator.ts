// A same-named decorator not imported from @nestjs/common is not checked.
const Body = (): ParameterDecorator => () => undefined;

export class NotAController {
  handle(@Body() body: unknown) {
    return body;
  }
}
