# TASKS — PHASE 9.0: THE LIVING 3D OFFICE & WORKFORCE PERSONAS

## ETAPA 1: PERSONAS, LORE & GERADOR DE DIÁLOGOS VIVOS
- [x] 1.1 Expandir `frontend/src/config/officeLayout.ts` com biografias completas, idades, manias, rixas e traços dos 5 funcionários + CEO
- [x] 1.2 Criar `frontend/src/services/watercoolerEngine.ts` para geração de conversas orgânicas, fofocas corporativas, piadas e reações a eventos
- [x] 1.3 Atualizar `src/office/registry.ts` no backend com os mesmos perfis canônicos

## ETAPA 2: CENA 3D & COMPONENTES THREE.JS / R3F
- [x] 2.1 Criar modelos 3D procedurais: Chão, Paredes, Mesas, Monitores CRT com glow, Cadeiras, Sala de Reunião, Máquina de Café e Plantas (`frontend/src/scenes/Office3DFurniture.tsx`)
- [x] 2.2 Criar Avatares 3D dos funcionários com animações de digitação, balanço de cabeça e balões de fala (`frontend/src/scenes/Office3DAvatar.tsx`)
- [x] 2.3 Criar cena principal `frontend/src/scenes/Office3DScene.tsx` com iluminação ambiente, sombras suaves, OrbitControls e posições de câmera interativas

## ETAPA 3: TOCA-DISCOS & SISTEMA DE ÁUDIO DO ESCRITÓRIO
- [x] 3.1 Criar componente 3D do Toca-Discos de Vinil (`TurntableVinyl.tsx`) com disco giratório e braço de agulha
- [x] 3.2 Criar player de áudio lo-fi/synthwave relaxante no HUD (`frontend/src/components/TurntablePlayer.tsx`) com controle de faixas, play/pause e volume

## ETAPA 4: CHAT DO ESCRITÓRIO COM ÁREA DE COMANDO & WATERCOOLER
- [x] 4.1 Expandir `frontend/src/components/GlobalOfficeChat.tsx` com abas "Comando do CEO" e "Conversa de Corredor (Watercooler)"
- [x] 4.2 Permitir ao CEO conversar livremente com qualquer funcionário ou com o escritório inteiro, recebendo respostas com as personalidades autênticas
- [x] 4.3 Integrar balões de fala 3D que sincronizam com as mensagens do chat

## ETAPA 5: HUD IMERSIVO & INTEGRAÇÃO DE LAYOUT
- [x] 5.1 Atualizar `frontend/src/pages/Home.tsx` com o Canvas 3D como tela principal e HUDs flutuantes colapsáveis
- [x] 5.2 Estilizar HUD imersivo com vidro fosco (glassmorphism), controles de câmera no topo e barra de status transparente
- [x] 5.3 Conectar seleção de agentes em 3D com o `AgentInspector.tsx` (Dossiê expandido com biografia e fotos)

## ETAPA 6: TESTES, BUILD & DEPLOY
- [x] 6.1 Criar suíte de testes `tests/office-living-workforce.test.ts` validando personas, engine de watercooler e integração
- [x] 6.2 Validar build backend (`typecheck`, `build`) e frontend Vite (`npm run build`)
- [x] 6.3 Commit, push para `origin/main` e deploy oficial no Cloudflare Workers
