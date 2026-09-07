# PUB DEV LOOP (PDL) — ESTADO ATUAL DO PROJETO (CURRENT STATE)
**Documento Canônico de Estado Operacional, Arquitetura e Engenharia**  
*Última atualização: Março de 2026*

---

## 1. RESUMO EXECUTIVO & VISÃO GERAL

O **PUB DEV LOOP (PDL)** é a plataforma de engenharia de software autônoma e central de comando espacial da **PUB Core Holding**. O sistema opera sob o paradigma **Cloud-First & Office-First**, unificando:
- Uma **Central de Comando 3D Interativa** (WebGL / Three.js) com estética Cyberpunk / PUB Records, representando fisicamente a holding, o estúdio do CEO, auditório de eventos, sala de jogos retro e 10 salas temáticas para 50 agentes de IA especializados.
- Um **Catálogo Canônico de 52 Projetos** distribuídos em 10 setores operacionais com matriz de maturidade (Produção, Beta, Protótipo, Legado).
- Um **Motor de Execução de Tarefas (Worker Loop)** com leasing transacional, workspaces isolados via Git e roteamento com fallback automático entre gateways de LLM (OpenRouter / 9Router local).
- Um **Framework Organizacional (The Office)** com tipagem estrita de decisões, governança de memória, lições aprendidas e checkpoints de aprovação soberana pelo CEO.

---

## 2. STATUS EM PRODUÇÃO & DEPLOY ATUAL

| Componente | Ambiente / Hospedagem | URL / Acesso | Status |
|---|---|---|---|
| **Frontend 3D (The Office)** | Cloudflare Workers (Static Assets) | https://pub-dev-loop-3d.contato-pubcore.workers.dev | **ONLINE (60 FPS)** |
| **Código Fonte Principal** | GitHub | https://github.com/pubcoreagencia/pub-dev-loop (branch main) | **SINCRONIZADO** |
| **API Backend / Worker** | Node.js / Docker / Cloudflare Worker | Porta local 3001 / Worker remoto Cloudflare | **OPERACIONAL** |
| **Roteador de Modelos (9Router)** | Docker / Local proxy | Porta 20128 (Fallback gateway) | **OPERACIONAL** |
| **Gateway Primário** | OpenRouter API | Endpoint remoto com modelos Curated Free & Fallback | **OPERACIONAL** |

---

## 3. ARQUITETURA IMPLEMENTADA: O QUE REALMENTE FUNCIONA

#### 3.1. Frontend 3D & Experiência Espacial (`frontend/src/scenes/`)
- **WebGL Otimizado (Renderização Isolada Sob Demanda):**
  - Na visualização macro do escritório (`overview`), os avatares pesados (`Office3DAvatar`) **não são instanciados simultaneamente**, evitando travamentos de WebGL e gargalos de draw calls.
  - Cada sala exibe **proxies estáticos ultra-leves** (mesas, monitores e silhuetas de baixa contagem poligonal sem `useFrame`).
  - Ao selecionar uma das 10 salas de squads ou a área executiva, os avatares interativos completos daquela sala específica são montados instantaneamente com balões de fala e status de trabalho.
- **Ambiente Imersivo Completo:**
  - **Estúdio do CEO (PUB Records):** Console SSL, bateria acústica, sintetizador, controles interativos de áudio e toca-discos de vinil funcional.
  - **Auditório & Palco de Eventos:** Telão LED com identidade visual oficial PUB REC, plateia e modo conferência/reunião geral.
  - **Arcade Zone (Habbo Retro):** Sala de jogos com fliperamas e mobis clássicos.
  - **Mobilidade Interativa:** Kart pilotável estilo Gather.Town e movimentação WASD do CEO com câmera orbital inteligente.

### 3.2. Catálogo & Organização dos 52 Projetos (`src/office/squads.ts`)
A holding está mapeada em 10 setores temáticos, cada um com 5 agentes e seus repositórios vinculados:
1. **Soluções Corporativas & IA:** `pubcore`, `pub-core-holding-portal`, `pub-core-os`, `leadcore`, `pub-leads`.
2. **E-Commerce & Varejo:** `pub-ecom`, `pub-ecom-catalog-worker`, `pub-ecom-landing`, `pubecomhub`, `pub-machine-saas`.
3. **Mídia, Entretenimento & Moda:** `pub-films`, `pub-media`, `pub-textil`, `pub-records`, `xp-audio-lab`.
4. **iGaming & Apostas:** `pubet`, `ia-pubcrypto`.
5. **Tecnologias Imersivas & Games:** `pub-3d`, `pub-games-studio`, `buzios-de-cima`, `eternize-seu-pinscher`.
6. **Machine Learning & Plataformas de IA:** `pub-ia`, `pub-machine`, `pub-machine-2`, `neural-os`.
7. **Marketing, Growth & Captação:** `pubgrowthai`, `pubgrowth-ai-evolution`, `pubfood-control-growth`, `pub-agencia-landing`, `pubcoreagencia.github.io`.
8. **Engenharia de Dados & Automação:** `pub-scrapping`, `pub-shopee-scraper`, `pub-dev-loop-template`, `pub-ops-hub`.
9. **Fintech, Web3 & Criptoativos:** `pub-crypto`, `pub-trade`.
10. **Proptech, Hospitalidade & Novos Negócios:** `pub-imoveis`, `pub-bnb`, `pub-start`, `pub-co`, `pub-prototype`, `pub-dev-loop-prototypes`.

### 3.3. Motor de Execução e Resiliência (`src/worker-service.ts` & `src/agent.ts`)
- **Lease Seguro de Tarefas:** Previne execução concorrente através de timestamps de lease no banco de dados.
- **Workspaces Efêmeros:** Cada tarefa clona o repositório em um diretório temporário (mkdtemp).
- **Validação de Workspace (src/finalizer.ts):** Captura hashes SHA-256 antes da execução e garante que apenas arquivos autorizados sejam modificados, rejeitando comandos Git perigosos (force push, reset hard).
- **Dual Gateway Fallback:** Caso o gateway primário (OpenRouter) retorne erro de cota (HTTP 429) ou instabilidade (HTTP 5xx), a tarefa migra automaticamente para o 9Router local.

---

## 4. O QUE ESTÁ PARCIAL, EXPERIMENTAL OU CONCEITUAL

### 4.1. Camada de Decisão e Governança (The Office em src/office/*)
- **Status:** **PARCIAL / EXPERIMENTAL**.
- **Realidade:** Os arquivos planning.ts, context-assembly.ts, decision-context.ts, memory-governance.ts, lesson-validation.ts e skills.ts contêm contratos TypeScript e funções puras determinísticas rigorosamente testadas em testes unitários.
- **Lacuna Atual:** No ciclo real do worker-service.ts, o prompt da tarefa é enviado diretamente à LLM sem que a esteira de context-assembly.ts injete dinamicamente as lições aprendidas anteriores. O motor existe no repositório, mas opera de forma desacoplada do runtime de execução das tarefas.

### 4.2. Automação Autônoma de Engenharia (O Ciclo Fechado)
- **Status do Loop:**
  - **Identificação & Lease:** ✅ IMPLEMENTADO.
  - **Pesquisa Externa (Web/Docs/GitHub):** ❌ AUSENTE.
  - **Descoberta Dinâmica de Skills (Find Skills):** ❌ AUSENTE.
  - **Execução do Código:** ✅ IMPLEMENTADO.
  - **Loop de Teste e Autocorreção (Test → Fix → Retest):** ⚠️ PARCIAL (o teste só ocorre se estiver explícito no prompt; não há re-injeção automática de erros para o modelo tentar novamente na mesma tarefa).
  - **UX Testing Automatizado (Screenshots/Playwright):** ❌ AUSENTE.
  - **Extração de Aprendizado & Memória Reutilizável:** ⚠️ EXPERIMENTAL.

---

## 5. DIAGNÓSTICO DO PROBLEMA VISUAL ESPECÍFICO

### Causa Técnica do Problema de Renderização dos Funcionários Centrais:
1. **Condição de Estado Fixa:** A bancada executiva central só montava os avatares interativos se selectedSectorId === 'executive'. Ao aproximar a câmera manualmente com o mouse sem clicar no botão da barra superior, o sistema continuava exibindo o proxy simplificado.
2. **Oclusão e Clipping:** A grande bancada de coworking central (11.5 metros de largura por 3.2 metros de profundidade) foi posicionada no pátio aberto entre o Estúdio e o Auditório, criando sobreposição de geometrias com monitores e cadeiras em ângulos rasos de câmera.
3. **Decisão de Design:** Conforme diretriz do CEO, a equipe de liderança/executiva deve ser transferida para uma **sala dedicada fechada (Sala da Diretoria)**, desobstruindo o centro do escritório para circulação livre e eliminando o problema de renderização.

---

## 6. MATRIZ DE REGRAS E INVARIANTES ABSOLUTOS

1. **Office First:** O escritório virtual 3D e a colaboração visível entre squads é a experiência central, nunca um painel administrativo tradicional.
2. **Soberania do CEO:** Nenhuma ação autônoma pode aprovar produção, alterar regras de segurança, migrar esquemas de banco ou ignorar o limite de revisões (MAX_REVIEW_ITERATIONS = 3) sem aprovação explícita do CEO Matheus Paes.
3. **Precedência da Evidência:**  
   \text{RUNTIME ATUAL} > \text{EXECUÇÃO REAL} > \text{REVIEW REAL} > \text{QA REAL} > \text{LIÇÕES VALIDADAS} > \text{MEMÓRIA HISTÓRICA}
4. **Isolamento de Tenant & Projeto:** Nenhuma informação ou segredo vaza entre os repositórios dos 52 projetos.
5. **Zero Fake Activity:** Todas as métricas, tarefas e movimentações refletem eventos e dados empíricos reais.
6. **pt-BR First:** A interface de controle e interação do escritório é padronizada em Português do Brasil.
7. **Persistence-First:** O Git e o banco de dados são as únicas fontes duráveis de verdade.

---

## 7. PRÓXIMOS PASSOS PRIORITÁRIOS (ROADMAP)

1. **Sala da Diretoria (Visual & Espacial):**
   - Criar a sala fechada para a Liderança Executiva (CEO e diretores), retirando a bancada do centro do pátio e liberando a área de circulação e visualização macro.
2. **Loop Fechado de Teste & Correção (Worker Engine):**
   - Integrar hook obrigatório no `worker-service.ts` para rodar `npm run build` e testes após a escrita do código. Se falhar, reenviar o erro para a LLM corrigir autonomamente antes de comitar.
3. **Ativação Real da Memória e Lições Aprendidas:**
   - Conectar o learning-feedback.ts ao término da tarefa para salvar lições úteis e injetá-las em prompts de tarefas futuras no mesmo projeto.
4. **Find Skills & Pesquisa Dinâmica:**
   - Permitir que o agente consulte um catálogo de skills e acople ferramentas sob demanda para tarefas especializadas.
