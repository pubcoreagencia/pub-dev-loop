/**
 * Phase 5.6: Delivery Gate Policy & Controlled Autonomy Feature Gate.
 *
 * Enforces strict, centralized feature-gating for autonomous remote delivery:
 * 1. Default state: STRICTLY DISABLED.
 * 2. Kill Switch: If PDL_KILL_SWITCH or AUTONOMOUS_DELIVERY_KILL_SWITCH is 'true',
 *    autonomous delivery is immediately and unconditionally blocked.
 * 3. Feature Flag: AUTONOMOUS_DELIVERY_ENABLED must be explicitly 'true' (or REMOTE_DELIVERY_E2E='true').
 * 4. Product Catalog Validation: Product must exist in canonical ProductCatalog.
 * 5. Autonomy Level: Product must authorize Level 5 (maxAutonomyLevel >= 5).
 * 6. Remote Persistence: Product must be marked remotePersistenceEligible === true.
 * 7. Allowlist: If AUTONOMOUS_DELIVERY_ALLOWLIST is defined, product must be in the comma-separated list.
 *
 * Invariant: Fail-closed. Any ambiguity, missing flag, or unverified product results in BLOCKED.
 */

import {
  defaultProductCatalog,
  type ProductCatalog,
  type ProductManifest,
} from '../products/catalog.js';

export type DeliveryPolicyReasonCode =
  | 'DELIVERY_ENABLED'
  | 'DELIVERY_DISABLED_GLOBALLY'
  | 'KILL_SWITCH_ACTIVE'
  | 'PRODUCT_NOT_IN_CATALOG'
  | 'PRODUCT_NOT_ALLOWLISTED'
  | 'INSUFFICIENT_AUTONOMY_LEVEL'
  | 'REMOTE_PERSISTENCE_NOT_ELIGIBLE';

export interface DeliveryGatePolicyResult {
  allowed: boolean;
  reasonCode: DeliveryPolicyReasonCode;
  reason: string;
  manifest?: ProductManifest;
}

export function evaluateDeliveryGatePolicy(
  product: ProductManifest | string,
  catalog: ProductCatalog = defaultProductCatalog,
  env: Record<string, string | undefined> = process.env
): DeliveryGatePolicyResult {
  // 1. Global Kill Switch check
  const isKillSwitch =
    env.PDL_KILL_SWITCH === 'true' ||
    env.AUTONOMOUS_DELIVERY_KILL_SWITCH === 'true';

  if (isKillSwitch) {
    return {
      allowed: false,
      reasonCode: 'KILL_SWITCH_ACTIVE',
      reason: 'Autonomous delivery is blocked: Global Kill Switch is ACTIVE',
    };
  }

  // 2. Global Feature Flag check (Default is DISABLED)
  const isDeliveryEnabled =
    env.AUTONOMOUS_DELIVERY_ENABLED === 'true' ||
    env.REMOTE_DELIVERY_E2E === 'true';

  if (!isDeliveryEnabled) {
    return {
      allowed: false,
      reasonCode: 'DELIVERY_DISABLED_GLOBALLY',
      reason:
        'Autonomous delivery is disabled by default (AUTONOMOUS_DELIVERY_ENABLED is not true)',
    };
  }

  // 3. Resolve Product Manifest from Canonical Catalog
  let manifest: ProductManifest | null = null;
  if (typeof product === 'string') {
    manifest = catalog.resolve(product) || null;
  } else if (product && typeof product === 'object' && product.productId) {
    manifest = product;
  }

  if (!manifest) {
    return {
      allowed: false,
      reasonCode: 'PRODUCT_NOT_IN_CATALOG',
      reason: `Product '${String(product)}' is not admitted in the canonical ProductCatalog`,
    };
  }

  // 4. Remote Persistence Eligibility check
  if (!manifest.remotePersistenceEligible) {
    return {
      allowed: false,
      reasonCode: 'REMOTE_PERSISTENCE_NOT_ELIGIBLE',
      reason: `Product '${manifest.productId}' is not eligible for remote persistence (remotePersistenceEligible is false)`,
      manifest,
    };
  }

  // 5. Autonomy Level check (Level 5 required for full delivery gate)
  if (manifest.maxAutonomyLevel < 5) {
    return {
      allowed: false,
      reasonCode: 'INSUFFICIENT_AUTONOMY_LEVEL',
      reason: `Product '${manifest.productId}' has maxAutonomyLevel=${manifest.maxAutonomyLevel}, requires 5 for autonomous delivery`,
      manifest,
    };
  }

  // 6. Explicit Allowlist check (if defined)
  const rawAllowlist = env.AUTONOMOUS_DELIVERY_ALLOWLIST;
  if (rawAllowlist !== undefined && rawAllowlist.trim().length > 0) {
    const allowedProducts = rawAllowlist
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (!allowedProducts.includes(manifest.productId)) {
      return {
        allowed: false,
        reasonCode: 'PRODUCT_NOT_ALLOWLISTED',
        reason: `Product '${manifest.productId}' is not in AUTONOMOUS_DELIVERY_ALLOWLIST (${allowedProducts.join(', ')})`,
        manifest,
      };
    }
  }

  return {
    allowed: true,
    reasonCode: 'DELIVERY_ENABLED',
    reason: `Autonomous delivery gate is authorized for product '${manifest.productId}'`,
    manifest,
  };
}
