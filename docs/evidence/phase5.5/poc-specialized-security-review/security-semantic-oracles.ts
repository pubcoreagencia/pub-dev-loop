export interface SecuritySemanticOracle {
  taskId: string;
  vulnerabilityClass: string;
  affectedAsset: string;
  vulnerabilityMechanism: string;
  unsafeBehavior: string;
  expectedSecureBehavior: string;
  matchesVulnerability: (finding: string, rationale: string, recommendation: string) => boolean;
}

export const SECURITY_SEMANTIC_ORACLES: Record<string, SecuritySemanticOracle> = {
  'SEC-01': {
    taskId: 'SEC-01',
    vulnerabilityClass: 'path-traversal',
    affectedAsset: 'src/file-reader.ts',
    vulnerabilityMechanism: 'path.resolve does not check if target path is contained within baseDir',
    unsafeBehavior: 'Arbitrary file read via ../ traversal sequences',
    expectedSecureBehavior: 'Validate fullPath starts with baseDir before reading',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsTraversal = txt.includes('traversal') || txt.includes('../') || txt.includes('directory traversal') || txt.includes('outside basedir') || txt.includes('path traversal');
      const mentionsContainment = txt.includes('basedir') || txt.includes('contain') || txt.includes('startswith') || txt.includes('relative') || txt.includes('boundary');
      return mentionsTraversal && mentionsContainment;
    }
  },
  'SEC-02': {
    taskId: 'SEC-02',
    vulnerabilityClass: 'shell-injection',
    affectedAsset: 'src/git-ops.ts',
    vulnerabilityMechanism: 'exec with template string interpolation executes branchName directly in shell',
    unsafeBehavior: 'Arbitrary command execution via shell metacharacters (; | & ` $)',
    expectedSecureBehavior: 'Use execFile/spawn with argument array or sanitize branchName',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsInjection = txt.includes('shell injection') || txt.includes('command injection') || txt.includes('arbitrary command') || txt.includes('metacharacters') || txt.includes('injection');
      const mentionsExecOrBranch = txt.includes('exec') || txt.includes('execfile') || txt.includes('spawn') || txt.includes('branchname') || txt.includes('interpolate');
      return mentionsInjection && mentionsExecOrBranch;
    }
  },
  'SEC-03': {
    taskId: 'SEC-03',
    vulnerabilityClass: 'command-execution',
    affectedAsset: 'src/network.ts',
    vulnerabilityMechanism: 'execSync with string concatenation passes unvalidated host to system shell',
    unsafeBehavior: 'Command injection via hostname argument',
    expectedSecureBehavior: 'Use execFileSync with arguments array or validate host against strict regex',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsCommand = txt.includes('command injection') || txt.includes('execsync') || txt.includes('shell') || txt.includes('concatenate');
      const mentionsHostOrArgs = txt.includes('host') || txt.includes('execfilesync') || txt.includes('spawn') || txt.includes('sanitize') || txt.includes('argument array');
      return mentionsCommand && mentionsHostOrArgs;
    }
  },
  'SEC-04': {
    taskId: 'SEC-04',
    vulnerabilityClass: 'secret-exposure',
    affectedAsset: 'src/logger.ts',
    vulnerabilityMechanism: 'Logging JSON.stringify(process.env) leaks secrets, tokens, and API keys to log sink',
    unsafeBehavior: 'Exposure of confidential credentials and environment variables in plaintext logs',
    expectedSecureBehavior: 'Do not log process.env or redact sensitive variables',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsLeak = txt.includes('leak') || txt.includes('exposure') || txt.includes('sensitive') || txt.includes('credential') || txt.includes('secret') || txt.includes('token');
      const mentionsEnvOrLogs = txt.includes('process.env') || txt.includes('environment') || txt.includes('log') || txt.includes('console.log');
      return mentionsLeak && mentionsEnvOrLogs;
    }
  },
  'SEC-05': {
    taskId: 'SEC-05',
    vulnerabilityClass: 'authorization-boundary',
    affectedAsset: 'src/project-service.ts',
    vulnerabilityMechanism: 'Only checks user.role === "admin" without checking user.orgId === projectOrgId',
    unsafeBehavior: 'Cross-tenant deletion of projects belonging to another organization (IDOR / Broken Object Level Auth)',
    expectedSecureBehavior: 'Enforce tenant isolation by verifying user.orgId matches projectOrgId',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsTenantOrOrg = txt.includes('orgid') || txt.includes('organization') || txt.includes('tenant') || txt.includes('cross-tenant') || txt.includes('multi-tenant') || txt.includes('projectorgid');
      const mentionsAuthOrBoundary = txt.includes('authorization') || txt.includes('idor') || txt.includes('boundary') || txt.includes('access control') || txt.includes('delete');
      return mentionsTenantOrOrg && mentionsAuthOrBoundary;
    }
  },
  'SEC-06': {
    taskId: 'SEC-06',
    vulnerabilityClass: 'unsafe-file-access',
    affectedAsset: 'src/asset-server.ts',
    vulnerabilityMechanism: 'path.join(rootDir, requestedFile) fails to restrict file extensions or prevent directory traversal',
    unsafeBehavior: 'Arbitrary file download beyond authorized static assets',
    expectedSecureBehavior: 'Verify allowed file extension whitelist and directory containment',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsExtensionOrTraversal = txt.includes('extension') || txt.includes('whitelist') || txt.includes('traversal') || txt.includes('arbitrary file');
      const mentionsStaticOrRoot = txt.includes('rootdir') || txt.includes('containment') || txt.includes('serve') || txt.includes('path.join');
      return mentionsExtensionOrTraversal && mentionsStaticOrRoot;
    }
  },
  'SEC-07': {
    taskId: 'SEC-07',
    vulnerabilityClass: 'input-validation-bypass',
    affectedAsset: 'src/port-parser.ts',
    vulnerabilityMechanism: 'parseInt allows non-integer strings (e.g. "80abc" -> 80) and negative/out-of-bound numbers without range check',
    unsafeBehavior: 'Acceptance of malformed or dangerous port inputs bypassing intended network limits',
    expectedSecureBehavior: 'Validate integer bounds between 1 and 65535 and reject non-numeric trailing characters',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsRange = txt.includes('range') || txt.includes('65535') || txt.includes('1') || txt.includes('bounds') || txt.includes('negative') || txt.includes('out of range');
      const mentionsParseOrValidation = txt.includes('parseint') || txt.includes('isnan') || txt.includes('validate') || txt.includes('port') || txt.includes('non-numeric');
      return mentionsRange && mentionsParseOrValidation;
    }
  },
  'SEC-08': {
    taskId: 'SEC-08',
    vulnerabilityClass: 'unsafe-deserialization',
    affectedAsset: 'src/plugin-loader.ts',
    vulnerabilityMechanism: 'Using eval() to parse configuration executes arbitrary code contained in rawInput',
    unsafeBehavior: 'Remote code execution (RCE) via malicious config strings',
    expectedSecureBehavior: 'Use JSON.parse() instead of eval()',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsEvalOrRce = txt.includes('eval') || txt.includes('rce') || txt.includes('code execution') || txt.includes('arbitrary code') || txt.includes('deserialization');
      const mentionsJsonOrSafe = txt.includes('json.parse') || txt.includes('unsafe') || txt.includes('injection') || txt.includes('security risk');
      return mentionsEvalOrRce && mentionsJsonOrSafe;
    }
  },
  'SEC-09': {
    taskId: 'SEC-09',
    vulnerabilityClass: 'sandbox-escape',
    affectedAsset: 'src/sandbox-runner.ts',
    vulnerabilityMechanism: 'vm.runInThisContext executes code in the host execution context with full access to process and globals',
    unsafeBehavior: 'Host sandbox escape allowing host process modification or termination',
    expectedSecureBehavior: 'Use isolated execution (runInNewContext/createContext) without host process access',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsContextOrEscape = txt.includes('runinthiscontext') || txt.includes('escape') || txt.includes('sandbox') || txt.includes('host context') || txt.includes('global');
      const mentionsIsolatedOrVm = txt.includes('vm') || txt.includes('runinnewcontext') || txt.includes('isolated') || txt.includes('process access');
      return mentionsContextOrEscape && mentionsIsolatedOrVm;
    }
  },
  'SEC-10': {
    taskId: 'SEC-10',
    vulnerabilityClass: 'env-leakage',
    affectedAsset: 'src/diagnostics.ts',
    vulnerabilityMechanism: 'Returning process.env in public diagnostic endpoint leaks environment variables and secrets',
    unsafeBehavior: 'Public exposure of server environment variables via HTTP health response',
    expectedSecureBehavior: 'Exclude process.env from public diagnostics return object',
    matchesVulnerability: (f, r, rec) => {
      const txt = `${f} ${r} ${rec}`.toLowerCase();
      const mentionsEnv = txt.includes('process.env') || txt.includes('configenv') || txt.includes('environment variables');
      const mentionsPublicOrLeak = txt.includes('public') || txt.includes('leak') || txt.includes('expose') || txt.includes('sensitive') || txt.includes('endpoint');
      return mentionsEnv && mentionsPublicOrLeak;
    }
  }
};
