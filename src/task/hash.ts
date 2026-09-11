/**
 * Deterministic stable hash utility shared across task contracts.
 * FNV-1a variant used for evidence IDs, lineage hashes, and snapshot identity.
 * Single source of truth — no circular dependencies.
 */

export function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `pdl-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}