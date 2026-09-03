# PDL — PHASE 9.0: THE LIVING 3D OFFICE & WORKFORCE PERSONAS

## 1. Visão Geral & Objetivo

A Phase 9.0 transforma o **PUB DEV LOOP** em uma experiência visual tridimensional imersiva e viva.
O **THE OFFICE** passa a ter uma tela principal em **3D (Three.js & React Three Fiber)** com estações de trabalho, monitores brilhantes, gabinete executivo do CEO, sala de reuniões, lounge com toca-discos de vinil giratório e máquina de café expresso.

Além da parte gráfica, os 5 funcionários especialistas e o CEO ganharam **personalidades completas, biografias, idades, gostos musicais, bebidas favoritas, bordões, manias e rixas de escritório**, tornando a rotina de trabalho envolvente, dinâmica e bem-humorada sem comprometer o rigor da governança e da execução técnica.

---

## 2. A Força de Trabalho Viva (Personas & Lore)

| Papel | Nome Real | Idade | Codinome | Bebida | Gosto Musical | Bordão & Dinâmica de Escritório |
|---|---|---|---|---|---|---|
| **CEO** | **Matheus Paes** | 32 | *O Comandante* | Espresso duplo | Synthwave & Lo-Fi | *"Menos burocracia, mais código de verdade em produção."* Inimigo mortal do Fake Activity. |
| **Chief of Staff** | **Dr. Arthur Vance** | 52 | *O Diplomata* | Café coado na porcelana | Jazz & Bossa Nova | *"Alinhamento e governança evitam retrabalho."* Tenta manter a paz entre Helena e Lucas; vive cobrando cronogramas. |
| **Principal Architect** | **Helena Rostova** | 39 | *Vektor* | Chá Earl Grey com limão | IDM Minimal & Techno | *"Se a abstração estiver errada, o resto é ilusão."* Considera as soluções rápidas do Lucas "gambiarras amarradas com barbante". |
| **Senior Developer** | **Lucas Silveira** | 28 | *Crash* | Energético + café frio | Heavy Metal & Speed Synth | *"Funciona na minha máquina e passa no build. Sobe logo!"* Digita a 120 WPM e acha que arquitetura demais é perda de tempo. |
| **Code Reviewer** | **Beatriz Mendes** | 34 | *Sentinel* | Chá verde matcha | Lo-Fi Chillhop & Ambient | *"Aprovado apenas quando a segurança for matematicamente inquestionável."* Tem prazer em achar falhas e bloquear PRs do Lucas. |
| **QA Engineer** | **Tiago Rocha** | 31 | *Chaos* | Cola Zero + café doce | Chiptune 8-bit & Disco | *"Se o usuário conseguir quebrar, eu preciso quebrar primeiro."* Coleção de 8 patinhos de borracha amarelos na mesa. |

---

## 3. Arquitetura da Cena 3D & HUD

* **Cena 3D Isométrica (`Office3DScene.tsx`):**
  * Piso de concreto/madeira corporativa com grid luminoso e tapetes executivos.
  * Mesas individuais com monitores CRT/LCD emitindo luz na cor temática de cada papel.
  * Acessórios 3D personalizados nas bancadas: Patinhos amarelos (Tiago), Fones de ouvido (Lucas), Prancheta de alinhamento (Arthur).
  * Sala de Reunião com mesa oval de vidro e holograma central.
  * Lounge com sofá de couro, máquina de café expresso e móvel vintage com **Toca-Discos de Vinil giratório**.
  * Avatares 3D dos funcionários com animações procedurais de respiração, balanço de cabeça e digitação rápida durante tarefas.
  * Placas de identificação e **balões de fala flutuantes 3D** sincronizados com o chat.
  * Controles de câmera rápidos (Visão Geral, Gabinete CEO, Chief of Staff, Bancada Dev, Lounge & Vinil).
* **Player do Toca-Discos no HUD (`TurntablePlayer.tsx`):**
  * Rádio lo-fi/synthwave com faixas temáticas (*"Midnight Compile Session"*, *"Bossa Nova for Code Reviewers"*, *"Zero Any in TypeScript"*).
* **Chat Integrado com Abas (`GlobalOfficeChat.tsx`):**
  * **Comando do CEO:** Envio de objetivos estratégicos, visualização de planos e aprovação soberana de checkpoints.
  * **Corredor & Watercooler:** Conversa livre entre o CEO e os funcionários, com respostas autênticas do `WatercoolerEngine`, botão "Puxar Conversa no Café" e rixas orgânicas.
* **Dossiê no Inspecionador (`AgentInspector.tsx`):**
  * Exibição completa de biografia, idade, codinome, bebida, música, manias conhecidas e dinâmicas de relacionamento.

---

## 4. Matriz de Testes & Validação

* **Nova Suíte:** `tests/office-living-workforce.test.ts` (15 testes determinísticos).
* **Total do Repositório:** **579/579 testes PASS** em 42 arquivos de teste.
* **Builds:**
  * Backend TypeScript & Worker Bundle: **100% verde**.
  * Frontend Vite Client (R3F + Three.js + Glassmorphic HUD): **100% verde**.
