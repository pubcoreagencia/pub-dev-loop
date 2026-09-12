import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export type GovernanceRole = 'READ' | 'ADMIN_WRITE';

export interface GovernancePrincipal {
  role: GovernanceRole;
  source: 'token' | 'key';
  identifier: string;
}

export interface GovernanceAuthConfig {
  adminKey?: string;
  readKey?: string;
}

/**
 * Timing-safe string comparison preventing timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    const hashA = crypto.createHash('sha256').update(bufA).digest();
    const hashB = crypto.createHash('sha256').update(bufB).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts raw Bearer token or API key from request headers.
 */
export function extractGovernanceToken(req: Request): string | null {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const xApiKey = req.headers['x-pdl-api-key'] || req.headers['x-governance-key'] || req.headers['X-PDL-API-Key'];
  if (typeof xApiKey === 'string' && xApiKey.trim()) {
    return xApiKey.trim();
  }
  return null;
}

/**
 * Authenticates a token against configured keys.
 * Fail-Closed Guarantee: If both adminKey and readKey are missing or empty, all access is denied.
 */
export function authenticateGovernanceToken(
  token: string | null | undefined,
  config?: GovernanceAuthConfig
): { principal?: GovernancePrincipal; error?: string; code: string; status: number } {
  const adminKey = config?.adminKey ?? process.env.PDL_GOVERNANCE_ADMIN_KEY;
  const readKey = config?.readKey ?? process.env.PDL_GOVERNANCE_READ_KEY;

  // Fail closed if auth configuration is missing
  if (!adminKey && !readKey) {
    return {
      error: 'Governance authentication configuration is missing (fail-closed)',
      code: 'AUTH_CONFIG_MISSING',
      status: 401,
    };
  }

  if (!token || !token.trim()) {
    return {
      error: 'Authentication credentials required',
      code: 'AUTHENTICATION_REQUIRED',
      status: 401,
    };
  }

  const trimmed = token.trim();

  // Admin key grants ADMIN_WRITE (and implicitly READ)
  if (adminKey && safeCompare(trimmed, adminKey)) {
    return {
      principal: {
        role: 'ADMIN_WRITE',
        source: 'key',
        identifier: 'governance-admin',
      },
      code: 'AUTHENTICATED',
      status: 200,
    };
  }

  // Read key grants READ
  if (readKey && safeCompare(trimmed, readKey)) {
    return {
      principal: {
        role: 'READ',
        source: 'key',
        identifier: 'governance-reader',
      },
      code: 'AUTHENTICATED',
      status: 200,
    };
  }

  return {
    error: 'Invalid governance credentials',
    code: 'INVALID_CREDENTIALS',
    status: 401,
  };
}

/**
 * Express middleware enforcing authentication and authorization for Governance endpoints.
 */
export function requireGovernanceAuth(
  requiredRole: GovernanceRole,
  configGetter?: () => GovernanceAuthConfig | undefined
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = configGetter ? configGetter() : undefined;
    const token = extractGovernanceToken(req);
    const result = authenticateGovernanceToken(token, config);

    if (!result.principal) {
      return res.status(result.status).json({
        error: result.error,
        code: result.code,
      });
    }

    if (requiredRole === 'ADMIN_WRITE' && result.principal.role !== 'ADMIN_WRITE') {
      return res.status(403).json({
        error: 'Forbidden: Administrative write privileges required',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRole: 'ADMIN_WRITE',
        currentRole: result.principal.role,
      });
    }

    (req as any).governancePrincipal = result.principal;
    next();
  };
}
