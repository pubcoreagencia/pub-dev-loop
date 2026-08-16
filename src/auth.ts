export type CodexAuthStatus = 'MISSING' | 'REFERENCE_CONFIGURED';
export const getCodexAuthStatus = (environment: NodeJS.ProcessEnv = process.env): CodexAuthStatus => environment.CODEX_AUTH_SECRET_REF ? 'REFERENCE_CONFIGURED' : 'MISSING';
