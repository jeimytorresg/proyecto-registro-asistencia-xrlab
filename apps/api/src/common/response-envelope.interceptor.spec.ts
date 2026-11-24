import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { ResponseMessage } from './response-message.decorator';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

class SampleController {
  plain(): void {}

  @ResponseMessage('Sesión válida.')
  withMessage(): void {}
}

function buildContext(handler: () => void, requestId?: string): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({
      getResponse: () => ({ locals: requestId ? { requestId } : {} }),
    }),
  } as unknown as ExecutionContext;
}

function buildNext(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor(new Reflector());

  it('envuelve el resultado con ok, data, message y requestId', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(
        buildContext(SampleController.prototype.plain, 'req-1'),
        buildNext({ uid: 'abc' }),
      ),
    );

    expect(result).toEqual({
      ok: true,
      data: { uid: 'abc' },
      message: 'Operación realizada correctamente.',
      requestId: 'req-1',
    });
  });

  it('usa el mensaje definido con @ResponseMessage', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(
        buildContext(SampleController.prototype.withMessage, 'req-2'),
        buildNext({ ok: 1 }),
      ),
    );

    expect(result).toMatchObject({ message: 'Sesión válida.', requestId: 'req-2' });
  });

  it('normaliza el 201 de Nest a 200 para mantener la paridad con el backend Express', async () => {
    const status = jest.fn();
    const context = {
      getHandler: () => SampleController.prototype.plain,
      getClass: () => SampleController,
      switchToHttp: () => ({
        getResponse: () => ({ locals: { requestId: 'req-3' }, statusCode: 201, status }),
      }),
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(context, buildNext({ id: 1 })));

    expect(status).toHaveBeenCalledWith(200);
  });

  it('no toca el status cuando ya no es 201', async () => {
    const status = jest.fn();
    const context = {
      getHandler: () => SampleController.prototype.plain,
      getClass: () => SampleController,
      switchToHttp: () => ({
        getResponse: () => ({ locals: {}, statusCode: 200, status }),
      }),
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(context, buildNext(null)));

    expect(status).not.toHaveBeenCalled();
  });

  it('usa "unknown" cuando la respuesta no tiene requestId', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(buildContext(SampleController.prototype.plain), buildNext(null)),
    );

    expect(result).toMatchObject({ ok: true, data: null, requestId: 'unknown' });
  });
});
