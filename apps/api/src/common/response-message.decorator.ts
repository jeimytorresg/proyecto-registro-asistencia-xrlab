import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'xrlab:response-message';

/** Define el `message` del envelope de éxito para un handler o controlador. */
export const ResponseMessage = (message: string): MethodDecorator & ClassDecorator =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
