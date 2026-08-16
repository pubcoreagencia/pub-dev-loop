# PUB DEV LOOP

Infraestrutura distribuída de desenvolvimento assistido por IA da PUB Core.

## Arquitetura atual

O projeto foi desenhado para coordenar **5 workers em 2 máquinas**:

### Windows
- Hermes
- Antigravity
- Codex

### macOS
- Antigravity
- Codex

O **GPT atua como cérebro/orquestrador**, gerando tarefas, analisando resultados e decidindo a próxima rodada. Os workers implementam as tarefas. O Git mantém isolamento, histórico e auditoria.

```text
GPT
 ↓
Orchestrator
 ↓
Task Queue
 ↓
Hermes / Antigravity / Codex
 ↓
Tests
 ↓
Git
 ↓
Results
 ↓
GPT
 ↓
Next Task
 ↺
```

## Documentação principal

Leia primeiro:

- [`MASTER_CONTEXT.md`](MASTER_CONTEXT.md)

O Master Context é a fonte de verdade da arquitetura, escopo, regras de concorrência, segurança e roadmap do projeto.

## V1

A primeira versão deve eliminar o fluxo manual de copiar e colar entre GPT e os agentes, mantendo:

- task queue;
- execução paralela;
- isolamento via Git worktrees/branches;
- coleta estruturada de resultados;
- testes obrigatórios;
- revisão pelo GPT;
- geração da próxima tarefa;
- retries e tratamento de falhas;
- kill switch;
- intervenção humana quando necessário.

**OpenClaw não faz parte da V1.**
