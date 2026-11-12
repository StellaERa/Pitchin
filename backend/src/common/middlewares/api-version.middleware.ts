import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export const CURRENT_API_VERSION = '1';
export const SUPPORTED_API_VERSIONS = ['1'] as const;
export const DEPRECATED_API_VERSIONS: string[] = [];
export const SUNSET_DATE = '2027-01-01';

/**
 * Middleware that adds API version metadata to every response.
 *
 * - `X-API-Version`: the resolved version serving this request.
 * - `X-API-Versions-Supported`: comma-separated list of active versions.
 * - `Sunset` and `Deprecation` headers when the version is deprecated.
 */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const version = this.resolveVersion(req);

    // The URI carries the version (e.g. /api/v1/issues). Serving an unknown
    // version silently as the default would let a client believe it is talking
    // to an API that does not exist, so reject it explicitly.
    if (!this.isKnownVersion(version)) {
      res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: `Unsupported API version "${version}". Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}`,
      });
      return;
    }

    res.setHeader('X-API-Version', version);
    res.setHeader(
      'X-API-Versions-Supported',
      SUPPORTED_API_VERSIONS.join(', '),
    );

    if (DEPRECATED_API_VERSIONS.includes(version)) {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', new Date(SUNSET_DATE).toUTCString());
      res.setHeader(
        'X-API-Warn',
        `Version ${version} is deprecated. Migrate to v${CURRENT_API_VERSION} before ${SUNSET_DATE}.`,
      );
    }

    next();
  }

  /**
   * Middleware runs before routing, so `req.params` is normally empty here;
   * the version therefore has to come from the URL. The route param is still
   * honoured when present (for versioned routers and tests).
   */
  private resolveVersion(req: Request): string {
    const fromParams = req.params?.version;
    if (typeof fromParams === 'string' && fromParams.length > 0) {
      return fromParams;
    }

    const path = req.path ?? req.url ?? '';
    return /\/v(\d+)(?:\/|$)/.exec(path)?.[1] ?? CURRENT_API_VERSION;
  }

  private isKnownVersion(version: string): boolean {
    return (
      (SUPPORTED_API_VERSIONS as readonly string[]).includes(version) ||
      DEPRECATED_API_VERSIONS.includes(version)
    );
  }
}
