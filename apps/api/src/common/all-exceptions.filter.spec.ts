import {
  type ArgumentsHost,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ApiError } from './api-error';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface FakeResponse {
  locals: Record<string, unknown>;
  status: jest.Mock;
  json: jest.Mock;
}

function buildHost(requestId = 'req-1'): { host: ArgumentsHost; res: FakeResponse } {
  const res: FakeResponse = {
    locals: { requestId },
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const req = { method: 'GET', path: '/api/nope' };

  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;

  return { host, res };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  it('responde un ApiError con su código y mensaje', () => {
    const { host, res } = buildHost();

    filter.catch(new ApiError(403, 'ROLE_FORBIDDEN', 'No tiene permisos.'), host);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'ROLE_FORBIDDEN', message: 'No tiene permisos.', requestId: 'req-1' },
    });
  });

  it('responde ruta no encontrada con el formato de Express', () => {
    const { host, res } = buildHost();

    filter.catch(new NotFoundException('Cannot GET /api/nope'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Ruta no encontrada: GET /api/nope',
        requestId: 'req-1',
      },
    });
  });

  it('responde 429 RATE_LIMITED cuando se excede el rate limit', () => {
    const { host, res } = buildHost();

    filter.catch(new ThrottlerException(), host);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: 'RATE_LIMITED' }),
      }),
    );
  });

  it('mapea una HttpException genérica a su código por status', () => {
    const { host, res } = buildHost();

    filter.catch(new HttpException('Conflicto', 409), host);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CONFLICT', message: 'Conflicto' }),
      }),
    );
  });

  it('mapea un error de body-parser (413) a PAYLOAD_TOO_LARGE', () => {
    const { host, res } = buildHost();
    const bodyParserError = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
      type: 'entity.too.large',
    });

    filter.catch(bodyParserError, host);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE' }),
      }),
    );
  });

  it('responde 500 genérico sin filtrar detalles internos y lo registra', () => {
    const { host, res } = buildHost();

    filter.catch(new Error('password=super-secret en la consulta'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = JSON.stringify(res.json.mock.calls[0]?.[0]);
    expect(body).toContain('INTERNAL_ERROR');
    expect(body).toContain('req-1');
    expect(body).not.toContain('super-secret');
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it('no intenta escribir otra respuesta si los headers ya se enviaron', () => {
    const { host, res } = buildHost();
    Object.assign(res, { headersSent: true });

    filter.catch(new ApiError(500, 'INTERNAL_ERROR', 'tarde'), host);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('responde 500 cuando se lanza un valor que no es un Error', () => {
    const { host, res } = buildHost();

    filter.catch('algo raro', host);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
