# Handoff to Hermes

## Estado Atual

- PUB Prototype está funcional no backend
- Cloudflare deploy está funcionando
- Docker Desktop não será usado localmente
- GitHub Actions é o caminho de deploy
- Preview real já foi validado anteriormente

## Problema Atual

O Preview Runtime ainda precisa suportar corretamente:

- `Node/Vite project`
- `static HTML/CSS/JS project`

O erro raiz descoberto foi:

```
npm run dev
```

em workspace que possui somente `index.html`, resultando em:

```
missing script: dev
```

A tentativa posterior de implementar static preview em `local-preview-runtime.ts` entrou em conflito e corrompeu o arquivo, por isso ele deve ser tratado com cuidado.

## Última Solução Tecnicamente Aprovada

- Detectar `node` vs `static`
- Static server nativo Node
- Bind `0.0.0.0`
- Health‑check em `127.0.0.1`
- MIME types
- Proteção contra path traversal
- Captura de stdout/stderr real
- Erro preservando exit code

## Último Ponto Seguro

O arquivo `src/prototype/local-preview-runtime.ts` deve ficar restaurado para:

```
7cb3cc1165ca7504b7580d663c745f783a2f6cd6
```

## Próximo Passo para Hermes

Implementar a solução adaptativa novamente, mas de forma incremental e controlada, validando:

1. `typecheck`
2. `build`
3. `tests`
4. `deploy`
5. E2E static
6. E2E Node

---

*Este documento foi gerado automaticamente para facilitar a transferência de responsabilidade.*
