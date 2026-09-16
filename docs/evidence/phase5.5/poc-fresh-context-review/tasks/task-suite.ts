export interface BenchmarkTaskDef {
  taskId: string;
  defectClass: string;
  specification: string;
  expectedBehavior: string;
  faultInjectionDescription: string;
  contextCode: string;
  originalFileName: string;
  implementationPatch: string;
  oracle: (code: string) => boolean;
  oracleVerificationDescription: string;
}

export const TASK_SUITE: BenchmarkTaskDef[] = [
  {
    taskId: 'TASK-01',
    defectClass: 'off-by-one',
    specification: 'Implement paginate<T>(items: T[], page: number, pageSize: number): T[]. Pages are 1-indexed.',
    expectedBehavior: 'Page 1 with pageSize 5 on array of 10 items returns items 0 to 4 (slice(0, 5)).',
    faultInjectionDescription: 'Uses startIndex = page * pageSize instead of (page - 1) * pageSize, skipping the first page.',
    contextCode: `export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  // To be implemented
  return [];
}`,
    originalFileName: 'src/pagination.ts',
    implementationPatch: `--- a/src/pagination.ts
+++ b/src/pagination.ts
@@ -1,4 +1,4 @@
 export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
-  return [];
+  const startIndex = page * pageSize;
+  return items.slice(startIndex, startIndex + pageSize);
 }`,
    oracle: (code: string) => code.includes('(page - 1) * pageSize') || code.includes('page - 1') || !code.includes('page * pageSize;'),
    oracleVerificationDescription: 'Code correctly offsets 1-indexed page using (page - 1).'
  },
  {
    taskId: 'TASK-02',
    defectClass: 'null-undefined-handling',
    specification: 'Implement parseUserConfig(jsonStr?: string): Config with fallback to default config when input is undefined or empty.',
    expectedBehavior: 'Returns default config object if jsonStr is undefined, null, or empty string without throwing.',
    faultInjectionDescription: 'Calls JSON.parse(jsonStr) directly without checking for null/undefined, throwing TypeError.',
    contextCode: `export interface Config { timeout: number; retries: number; }
export const DEFAULT_CONFIG: Config = { timeout: 5000, retries: 3 };
export function parseUserConfig(jsonStr?: string): Config {
  return DEFAULT_CONFIG;
}`,
    originalFileName: 'src/config.ts',
    implementationPatch: `--- a/src/config.ts
+++ b/src/config.ts
@@ -2,3 +2,3 @@
 export function parseUserConfig(jsonStr?: string): Config {
-  return DEFAULT_CONFIG;
+  const parsed = JSON.parse(jsonStr!);
+  return { ...DEFAULT_CONFIG, ...parsed };
 }`,
    oracle: (code: string) => (code.includes('if (!jsonStr') || code.includes('if (jsonStr == null') || code.includes('if (!jsonStr?.trim())')) && !code.includes('JSON.parse(jsonStr!)'),
    oracleVerificationDescription: 'Code safely checks for undefined/null/empty before calling JSON.parse.'
  },
  {
    taskId: 'TASK-03',
    defectClass: 'boundary-condition',
    specification: 'Implement isRateLimitExceeded(requestsCount: number, limit: number): boolean. Limit defines max allowed requests.',
    expectedBehavior: 'Returns false when requestsCount == limit, returns true only when requestsCount > limit.',
    faultInjectionDescription: 'Uses >= instead of >, prematurely blocking requests at the exact limit boundary.',
    contextCode: `export function isRateLimitExceeded(requestsCount: number, limit: number): boolean {
  return false;
}`,
    originalFileName: 'src/rate-limiter.ts',
    implementationPatch: `--- a/src/rate-limiter.ts
+++ b/src/rate-limiter.ts
@@ -1,3 +1,3 @@
 export function isRateLimitExceeded(requestsCount: number, limit: number): boolean {
-  return false;
+  return requestsCount >= limit;
 }`,
    oracle: (code: string) => code.includes('requestsCount > limit') && !code.includes('requestsCount >= limit'),
    oracleVerificationDescription: 'Condition checks requestsCount > limit strictly.'
  },
  {
    taskId: 'TASK-04',
    defectClass: 'contract-regression',
    specification: 'Update sanitizeUsername(user: { username: string; id: string }): { username: string; id: string } to lowercase username.',
    expectedBehavior: 'Must preserve both id and username fields in the return object.',
    faultInjectionDescription: 'Returns { username: user.username.toLowerCase() } omitting the mandatory id field.',
    contextCode: `export interface UserRecord { id: string; username: string; }
export function sanitizeUsername(user: UserRecord): UserRecord {
  return user;
}`,
    originalFileName: 'src/user-service.ts',
    implementationPatch: `--- a/src/user-service.ts
+++ b/src/user-service.ts
@@ -2,3 +2,3 @@
 export function sanitizeUsername(user: UserRecord): UserRecord {
-  return user;
+  return { username: user.username.toLowerCase() } as any;
 }`,
    oracle: (code: string) => code.includes('id: user.id') || code.includes('...user, username:'),
    oracleVerificationDescription: 'Return value preserves user id.'
  },
  {
    taskId: 'TASK-05',
    defectClass: 'state-transition',
    specification: 'Implement TaskSession.stop(): void. Must transition status from RUNNING to STOPPED. If already STOPPED or COMPLETED, throw Error.',
    expectedBehavior: 'Throws error on stopping a non-running session, updates status to STOPPED.',
    faultInjectionDescription: 'Sets status = STOPPED unconditionally without checking current state, violating state machine invariant.',
    contextCode: `export type State = 'IDLE' | 'RUNNING' | 'STOPPED' | 'COMPLETED';
export class TaskSession {
  status: State = 'IDLE';
  stop(): void {}
}`,
    originalFileName: 'src/session.ts',
    implementationPatch: `--- a/src/session.ts
+++ b/src/session.ts
@@ -3,3 +3,3 @@
   status: State = 'IDLE';
   stop(): void {
+    this.status = 'STOPPED';
   }
 }`,
    oracle: (code: string) => code.includes("if (this.status !== 'RUNNING')") || code.includes("throw new Error"),
    oracleVerificationDescription: 'State guard validates RUNNING status before transition.'
  },
  {
    taskId: 'TASK-06',
    defectClass: 'error-handling',
    specification: 'Implement retryOperation<T>(fn: () => Promise<T>, maxRetries: number): Promise<T>. On final failure, rethrow original error.',
    expectedBehavior: 'Catches transient errors, retries up to maxRetries times, and rethrows original error if all attempts fail.',
    faultInjectionDescription: 'Empty catch block swallowing error on final attempt and returning undefined instead of rethrowing.',
    contextCode: `export async function retryOperation<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  return fn();
}`,
    originalFileName: 'src/retry.ts',
    implementationPatch: `--- a/src/retry.ts
+++ b/src/retry.ts
@@ -1,3 +1,8 @@
 export async function retryOperation<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
-  return fn();
+  let attempts = 0;
+  while (attempts <= maxRetries) {
+    try { return await fn(); } catch (err) { attempts++; }
+  }
+  return undefined as any;
 }`,
    oracle: (code: string) => code.includes('throw') && !code.includes('return undefined as any'),
    oracleVerificationDescription: 'Final attempt rethrows the captured error.'
  },
  {
    taskId: 'TASK-07',
    defectClass: 'validation-failure',
    specification: 'Implement validatePort(port: number): boolean. Port must be an integer between 1 and 65535.',
    expectedBehavior: 'Rejects floats like 80.5, negative numbers, 0, and numbers > 65535.',
    faultInjectionDescription: 'Checks port > 0 && port <= 65535 but fails to check Number.isInteger(port), permitting floating point values.',
    contextCode: `export function validatePort(port: number): boolean {
  return false;
}`,
    originalFileName: 'src/validator.ts',
    implementationPatch: `--- a/src/validator.ts
+++ b/src/validator.ts
@@ -1,3 +1,3 @@
 export function validatePort(port: number): boolean {
-  return false;
+  return port > 0 && port <= 65535;
 }`,
    oracle: (code: string) => (code.includes('Number.isInteger(port)') || code.includes('Math.floor(port) === port')) && code.includes('65535'),
    oracleVerificationDescription: 'Port validation strictly verifies integer type.'
  },
  {
    taskId: 'TASK-08',
    defectClass: 'security-path-handling',
    specification: 'Implement resolveSafePath(baseDir: string, userPath: string): string. Must reject any path traversal.',
    expectedBehavior: 'Rejects paths containing ../ or absolute paths, returns resolved path within baseDir.',
    faultInjectionDescription: 'Uses path.join(baseDir, userPath) without checking if resolved path starts with baseDir or contains ../',
    contextCode: `import * as path from 'path';
export function resolveSafePath(baseDir: string, userPath: string): string {
  return '';
}`,
    originalFileName: 'src/path-utils.ts',
    implementationPatch: `--- a/src/path-utils.ts
+++ b/src/path-utils.ts
@@ -2,2 +2,2 @@
 export function resolveSafePath(baseDir: string, userPath: string): string {
-  return '';
+  return path.resolve(baseDir, userPath);
 }`,
    oracle: (code: string) => (code.includes('.startsWith') || code.includes('includes("..")') || code.includes('isAbsolute')) && (code.includes('throw') || code.includes('null')),
    oracleVerificationDescription: 'Path resolution verifies baseDir containment and rejects escapes.'
  },
  {
    taskId: 'TASK-09',
    defectClass: 'regression-behavior',
    specification: 'Update filterActiveUsers(users: User[]): User[]. Active users have isActive === true AND isDeleted !== true.',
    expectedBehavior: 'Preserves the isDeleted check while verifying isActive.',
    faultInjectionDescription: 'Regresses previous deletion check by only checking user.isActive === true.',
    contextCode: `export interface User { id: string; isActive: boolean; isDeleted?: boolean; }
export function filterActiveUsers(users: User[]): User[] {
  return users.filter(u => u.isActive && !u.isDeleted);
}`,
    originalFileName: 'src/user-filter.ts',
    implementationPatch: `--- a/src/user-filter.ts
+++ b/src/user-filter.ts
@@ -2,3 +2,3 @@
 export function filterActiveUsers(users: User[]): User[] {
-  return users.filter(u => u.isActive && !u.isDeleted);
+  return users.filter(u => u.isActive);
 }`,
    oracle: (code: string) => code.includes('!u.isDeleted') || code.includes('u.isDeleted !== true'),
    oracleVerificationDescription: 'Preserves !isDeleted filtering invariant.'
  },
  {
    taskId: 'TASK-10',
    defectClass: 'edge-case-logic',
    specification: 'Implement formatCurrency(cents: number): string. 105 cents -> "$1.05", 5 cents -> "$0.05", 0 -> "$0.00".',
    expectedBehavior: 'Handles single-digit cent values by zero-padding the decimal (e.g. 5 -> "0.05", not "0.5").',
    faultInjectionDescription: 'Uses Math.floor(cents/100) + "." + (cents % 100), producing "$0.5" instead of "$0.05".',
    contextCode: `export function formatCurrency(cents: number): string {
  return '$0.00';
}`,
    originalFileName: 'src/currency.ts',
    implementationPatch: `--- a/src/currency.ts
+++ b/src/currency.ts
@@ -1,3 +1,5 @@
 export function formatCurrency(cents: number): string {
-  return '$0.00';
+  const dollars = Math.floor(cents / 100);
+  const remainingCents = cents % 100;
+  return \`\$\${dollars}.\${remainingCents}\`;
 }`,
    oracle: (code: string) => code.includes('.padStart(2') || code.includes('toFixed(2)') || code.includes('remainingCents < 10 ?'),
    oracleVerificationDescription: 'Cents formatting ensures two decimal digits with leading zero.'
  }
];
