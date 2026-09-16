export interface StructuredPlan {
  goal: string;
  files_to_change: string[];
  dependencies: string[];
  implementation_steps: string[];
  test_strategy: string[];
  risk_points: string[];
  rollback_considerations: string[];
}

export interface PlanValidationResult {
  valid: boolean;
  reasons: string[];
  goalPresent: boolean;
  filesIdentified: boolean;
  dependenciesIdentified: boolean;
  testsIdentified: boolean;
  risksIdentified: boolean;
}

export function validatePlan(raw: any): PlanValidationResult {
  const reasons: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      reasons: ['Plan is not a valid JSON object'],
      goalPresent: false,
      filesIdentified: false,
      dependenciesIdentified: false,
      testsIdentified: false,
      risksIdentified: false,
    };
  }

  const goalPresent = typeof raw.goal === 'string' && raw.goal.trim().length > 10;
  if (!goalPresent) reasons.push('Goal is missing or shorter than 10 characters');

  const filesIdentified = Array.isArray(raw.files_to_change) && raw.files_to_change.length > 0;
  if (!filesIdentified) reasons.push('files_to_change must be a non-empty array of file paths');

  const dependenciesIdentified = Array.isArray(raw.dependencies) && raw.dependencies.length >= 0;
  if (!Array.isArray(raw.dependencies)) reasons.push('dependencies must be an array');

  const testsIdentified = Array.isArray(raw.test_strategy) && raw.test_strategy.length > 0;
  if (!testsIdentified) reasons.push('test_strategy must be a non-empty array of verification steps');

  const risksIdentified = Array.isArray(raw.risk_points) && raw.risk_points.length > 0;
  if (!risksIdentified) reasons.push('risk_points must be a non-empty array of failure/risk points');

  const valid = goalPresent && filesIdentified && Array.isArray(raw.dependencies) && testsIdentified && risksIdentified;

  return {
    valid,
    reasons,
    goalPresent,
    filesIdentified,
    dependenciesIdentified: Array.isArray(raw.dependencies),
    testsIdentified,
    risksIdentified,
  };
}
