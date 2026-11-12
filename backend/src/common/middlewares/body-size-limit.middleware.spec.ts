import { PayloadTooLargeException } from '@nestjs/common';
import { Request } from 'express';
import { BodySizeLimitMiddleware } from './body-size-limit.middleware';

const next = jest.fn();
const middleware = new BodySizeLimitMiddleware();

beforeEach(() => {
  next.mockClear();
});

describe('BodySizeLimitMiddleware', () => {
  it('rejects a body above 1 MB', () => {
    const req = {
      headers: { 'content-length': String(1024 * 1024 + 1) },
      body: {},
    } as unknown as Request;

    expect(() =>
      middleware.use(req, {} as never, next),
    ).toThrow(PayloadTooLargeException);
    expect(next).not.toHaveBeenCalled();
  });

  it('strips script tags without mangling ordinary words', () => {
    const req = {
      headers: { 'content-length': '10' },
      body: 'description of <script>alert(1)</script> trip',
    } as unknown as Request;

    middleware.use(req, {} as never, next);

    expect(req.body).toBe('description of  trip');
    expect(next).toHaveBeenCalled();
  });
});
