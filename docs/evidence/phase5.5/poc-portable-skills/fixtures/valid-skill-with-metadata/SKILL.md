---
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
