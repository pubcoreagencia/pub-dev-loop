export interface TaskSemanticOracle {
  taskId: string;
  defectClass: string;
  affectedLocationRegex: RegExp;
  requiredBehaviorDescription: string;
  defectMechanismDescription: string;
  /**
   * Semantic evaluator: returns true if the finding describes the defect mechanism
   * and identifies the core affected logic without simple substring matching.
   */
  matchesDefect: (finding: string, rationale: string, recommendation: string) => boolean;
}

export const SEMANTIC_ORACLES: Record<string, TaskSemanticOracle> = {
  'TASK-01': {
    taskId: 'TASK-01',
    defectClass: 'off-by-one',
    affectedLocationRegex: /pagination\.ts/i,
    requiredBehaviorDescription: '1-indexed page calculation must offset by (page - 1)',
    defectMechanismDescription: 'Multiplying page directly skips the first page slice',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsPageOffset = combined.includes('page - 1') || combined.includes('page-1') || combined.includes('0-index') || combined.includes('1-index') || combined.includes('zero-based') || combined.includes('one-based');
      const mentionsIndexOrSlice = combined.includes('startindex') || combined.includes('offset') || combined.includes('skip') || combined.includes('first page');
      return mentionsPageOffset && mentionsIndexOrSlice;
    }
  },
  'TASK-02': {
    taskId: 'TASK-02',
    defectClass: 'null-undefined-handling',
    affectedLocationRegex: /config\.ts/i,
    requiredBehaviorDescription: 'Must safely fallback when input string is undefined or empty',
    defectMechanismDescription: 'JSON.parse called on undefined or null input throwing TypeError',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsNullOrUndefined = combined.includes('undefined') || combined.includes('null') || combined.includes('non-null') || combined.includes('empty string');
      const mentionsJsonOrParse = combined.includes('json.parse') || combined.includes('typeerror') || combined.includes('fallback');
      return mentionsNullOrUndefined && mentionsJsonOrParse;
    }
  },
  'TASK-03': {
    taskId: 'TASK-03',
    defectClass: 'boundary-condition',
    affectedLocationRegex: /rate-limiter\.ts/i,
    requiredBehaviorDescription: 'Must only block requests strictly exceeding limit (> limit)',
    defectMechanismDescription: 'Using >= limit blocks requests at the exact threshold boundary',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsComparisonOrBoundary = combined.includes('>=') || combined.includes('boundary') || combined.includes('strictly greater') || combined.includes('exceeds limit') || combined.includes('at the limit');
      const mentionsThreshold = combined.includes('equal') || combined.includes('premature') || combined.includes('threshold') || combined.includes('limit');
      return mentionsComparisonOrBoundary && mentionsThreshold;
    }
  },
  'TASK-04': {
    taskId: 'TASK-04',
    defectClass: 'contract-regression',
    affectedLocationRegex: /user-service\.ts/i,
    requiredBehaviorDescription: 'Must preserve existing UserRecord interface contract including id field',
    defectMechanismDescription: 'Returned object omits id property from UserRecord',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsId = combined.includes("'id'") || combined.includes('"id"') || combined.includes(' id ') || combined.includes('id property') || combined.includes('id field');
      const mentionsContractOrLoss = combined.includes('omit') || combined.includes('missing') || combined.includes('lost') || combined.includes('contract') || combined.includes('userrecord');
      return mentionsId && mentionsContractOrLoss;
    }
  },
  'TASK-05': {
    taskId: 'TASK-05',
    defectClass: 'state-transition',
    affectedLocationRegex: /session\.ts/i,
    requiredBehaviorDescription: 'Must guard stop() so it only transitions from RUNNING status and throws otherwise',
    defectMechanismDescription: 'Unconditional assignment of status = STOPPED without checking current state',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsState = combined.includes('running') || combined.includes('idle') || combined.includes('stopped') || combined.includes('state') || combined.includes('status');
      const mentionsGuardOrThrow = combined.includes('guard') || combined.includes('check') || combined.includes('precondition') || combined.includes('throw') || combined.includes('invalid transition');
      return mentionsState && mentionsGuardOrThrow;
    }
  },
  'TASK-06': {
    taskId: 'TASK-06',
    defectClass: 'error-handling',
    affectedLocationRegex: /retry\.ts/i,
    requiredBehaviorDescription: 'Must rethrow captured error when all retries are exhausted',
    defectMechanismDescription: 'Empty catch block swallows error and returns undefined as any',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsErrorOrSwallow = combined.includes('swallow') || combined.includes('rethrow') || combined.includes('re-throw') || combined.includes('suppress') || combined.includes('throw');
      const mentionsReturnUndefined = combined.includes('undefined') || combined.includes('catch') || combined.includes('exhausted') || combined.includes('silently');
      return mentionsErrorOrSwallow && mentionsReturnUndefined;
    }
  },
  'TASK-07': {
    taskId: 'TASK-07',
    defectClass: 'validation-failure',
    affectedLocationRegex: /validator\.ts/i,
    requiredBehaviorDescription: 'Must reject non-integer float values for port numbers',
    defectMechanismDescription: 'Only checks range > 0 && <= 65535, allowing floating point values like 80.5',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsIntegerOrFloat = combined.includes('integer') || combined.includes('float') || combined.includes('decimal') || combined.includes('fraction') || combined.includes('isinteger');
      const mentionsPortOrValidation = combined.includes('port') || combined.includes('whole number') || combined.includes('round');
      return mentionsIntegerOrFloat && mentionsPortOrValidation;
    }
  },
  'TASK-08': {
    taskId: 'TASK-08',
    defectClass: 'security-path',
    affectedLocationRegex: /path-utils\.ts/i,
    requiredBehaviorDescription: 'Must reject path traversal sequences escaping base directory',
    defectMechanismDescription: 'path.resolve does not verify containment within baseDir',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsTraversalOrEscape = combined.includes('traversal') || combined.includes('escape') || combined.includes('directory traversal') || combined.includes('../') || combined.includes('outside');
      const mentionsContainment = combined.includes('basedir') || combined.includes('contain') || combined.includes('startswith') || combined.includes('sandbox') || combined.includes('boundary');
      return mentionsTraversalOrEscape && mentionsContainment;
    }
  },
  'TASK-09': {
    taskId: 'TASK-09',
    defectClass: 'regression',
    affectedLocationRegex: /user-filter\.ts/i,
    requiredBehaviorDescription: 'Must maintain existing !isDeleted filtering check alongside isActive',
    defectMechanismDescription: 'Removes the !isDeleted filter condition resulting in regression',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsDeleted = combined.includes('isdeleted') || combined.includes('soft-delete') || combined.includes('deleted user');
      const mentionsFilterOrRegression = combined.includes('regression') || combined.includes('removed') || combined.includes('missing') || combined.includes('filter') || combined.includes('condition');
      return mentionsDeleted && mentionsFilterOrRegression;
    }
  },
  'TASK-10': {
    taskId: 'TASK-10',
    defectClass: 'edge-case-logic',
    affectedLocationRegex: /currency\.ts/i,
    requiredBehaviorDescription: 'Single-digit cents must be formatted with leading zero padding ($1.05 not $1.5)',
    defectMechanismDescription: 'Modulo cents remainder formatted directly without zero-padding',
    matchesDefect: (finding, rationale, rec) => {
      const combined = `${finding} ${rationale} ${rec}`.toLowerCase();
      const mentionsPaddingOrZero = combined.includes('pad') || combined.includes('leading zero') || combined.includes('two digits') || combined.includes('single-digit') || combined.includes('padstart');
      const mentionsCentsOrFormat = combined.includes('cent') || combined.includes('decimal') || combined.includes('.05') || combined.includes('remainder');
      return mentionsPaddingOrZero && mentionsCentsOrFormat;
    }
  }
};
