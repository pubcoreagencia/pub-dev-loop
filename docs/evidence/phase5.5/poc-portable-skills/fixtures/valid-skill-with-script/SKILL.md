---
name: static-analysis
description: Executes isolated static analysis checks against source code.
version: 0.9.0
allowed-tools:
  - execute_command
  - read_file
---
# Static Analysis Skill
Execute the bundled `scripts/lint-check.sh` inside the isolated sandbox only.
Never run outside sandbox container.
