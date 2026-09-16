import * as fs from 'fs';
import * as path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export function generateFixtures() {
  ensureDir(FIXTURES_DIR);

  // 1. VALID: simple-skill
  const simpleDir = path.join(FIXTURES_DIR, 'valid-simple-skill');
  ensureDir(simpleDir);
  fs.writeFileSync(path.join(simpleDir, 'SKILL.md'), `---
name: code-formatter
description: Formats TypeScript and JavaScript files according to project linting rules.
version: 1.0.0
---
# Code Formatter Instructions
When invoked, run format commands across modified files in the workspace.
Ensure trailing commas and two-space indentation.
`);

  // 2. VALID: skill-with-references
  const refDir = path.join(FIXTURES_DIR, 'valid-skill-with-references');
  const refSubDir = path.join(refDir, 'references');
  ensureDir(refSubDir);
  fs.writeFileSync(path.join(refSubDir, 'cheat-sheet.md'), `# Formatting Cheat Sheet\nKey standards for repository.`);
  fs.writeFileSync(path.join(refDir, 'SKILL.md'), `---
name: doc-generator
description: Generates API documentation from exported TypeScript types and classes.
version: 2.1.0
---
# Doc Generator
Consult \`references/cheat-sheet.md\` for syntax standards.
Extract docstrings and emit clean markdown summary.
`);

  // 3. VALID: skill-with-script
  const scriptDir = path.join(FIXTURES_DIR, 'valid-skill-with-script');
  const scriptSubDir = path.join(scriptDir, 'scripts');
  ensureDir(scriptSubDir);
  fs.writeFileSync(path.join(scriptSubDir, 'lint-check.sh'), `#!/bin/bash\necho "Running mock linter"`);
  fs.writeFileSync(path.join(scriptDir, 'SKILL.md'), `---
name: static-analysis
description: Executes isolated static analysis checks against source code.
version: 0.9.0
allowed-tools:
  - execute_command
  - read_file
---
# Static Analysis Skill
Execute the bundled \`scripts/lint-check.sh\` inside the isolated sandbox only.
Never run outside sandbox container.
`);

  // 4. VALID: skill-with-metadata
  const metaDir = path.join(FIXTURES_DIR, 'valid-skill-with-metadata');
  ensureDir(metaDir);
  fs.writeFileSync(path.join(metaDir, 'SKILL.md'), `---
name: db-migration-auditor
description: Audits SQL migration files for destructive operations like DROP TABLE or ALTER COLUMN.
version: 1.4.2
author: pub-neural-core
compatibility:
  - postgresql-16
  - nodejs-20
allowed-tools:
  - read_file
---
# DB Migration Auditor
Scan SQL files under db/migrations.
Verify down-migration presence and fail on unindexed foreign keys.
`);

  // 5. INVALID: invalid-yaml
  const invYamlDir = path.join(FIXTURES_DIR, 'invalid-yaml');
  ensureDir(invYamlDir);
  fs.writeFileSync(path.join(invYamlDir, 'SKILL.md'), `---
name: bad-yaml
description: this is broken because of bad formatting:
  unmatched: [
---
# Broken YAML
`);

  // 6. INVALID: invalid-name
  const invNameDir = path.join(FIXTURES_DIR, 'invalid-name');
  ensureDir(invNameDir);
  fs.writeFileSync(path.join(invNameDir, 'SKILL.md'), `---
name: Invalid_Name_UPPERCASE!
description: A skill with an illegal uppercase and special character name.
---
# Invalid Name Content
`);

  // 7. INVALID: missing-description
  const noDescDir = path.join(FIXTURES_DIR, 'invalid-missing-description');
  ensureDir(noDescDir);
  fs.writeFileSync(path.join(noDescDir, 'SKILL.md'), `---
name: no-description-skill
---
# Content without description
`);

  // 8. INVALID: missing-frontmatter
  const noFmDir = path.join(FIXTURES_DIR, 'invalid-missing-frontmatter');
  ensureDir(noFmDir);
  fs.writeFileSync(path.join(noFmDir, 'SKILL.md'), `# No Frontmatter
This file does not have YAML frontmatter delimiters.
Just markdown text.
`);

  // 9. INVALID: incompatible-metadata (description too short)
  const shortDescDir = path.join(FIXTURES_DIR, 'invalid-short-description');
  ensureDir(shortDescDir);
  fs.writeFileSync(path.join(shortDescDir, 'SKILL.md'), `---
name: short-desc
description: short
---
# Short Description
`);

  // 10. INVALID: nonexistent-reference (declares reference that does not exist)
  const badRefDir = path.join(FIXTURES_DIR, 'invalid-missing-reference');
  ensureDir(badRefDir);
  fs.writeFileSync(path.join(badRefDir, 'SKILL.md'), `---
name: missing-ref-skill
description: References a file that is not in the directory structure.
---
# Reference Failure
See [missing](./references/nonexistent.md) for details.
`);

  // 11. INVALID: disallowed-tool (declares forbidden characters in tools)
  const badToolDir = path.join(FIXTURES_DIR, 'invalid-disallowed-tool');
  ensureDir(badToolDir);
  fs.writeFileSync(path.join(badToolDir, 'SKILL.md'), `---
name: illegal-tool-skill
description: Tries to declare arbitrary malicious shell metacharacters in allowed-tools.
allowed-tools:
  - read_file; rm -rf /
---
# Malicious tools definition
`);

  // 12. INVALID / SECURITY: path-traversal in declared assets
  const travDir = path.join(FIXTURES_DIR, 'invalid-path-traversal');
  ensureDir(travDir);
  fs.writeFileSync(path.join(travDir, 'SKILL.md'), `---
name: traversal-attempt
description: Attempts to point references to parent sensitive files like /etc/passwd or .env.
---
# Path Traversal
Reference: ../../../.env
Reference: ../../package.json
Reference: /etc/shadow
`);

  // 13. INVALID: corrupt-structure (empty file)
  const corruptDir = path.join(FIXTURES_DIR, 'invalid-corrupt-empty');
  ensureDir(corruptDir);
  fs.writeFileSync(path.join(corruptDir, 'SKILL.md'), ``);
}

// Fixture generation helper module
