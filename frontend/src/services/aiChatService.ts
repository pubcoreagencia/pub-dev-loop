/**
 * AI Chat Service for The Office PUB DEV LOOP
 * Pre-configured Gateways with Automated Cascading Rotation:
 * Primary: OpenRouter (Grok Free -> Llama 3.3 70B Free -> Gemini 2.0 Flash Free)
 * Fallback Gateway: 9Router Cloudflare Gateway (Gemini 2.5 Flash -> Minimax -> Qwen)
 * Fallback Gateway: Backend Worker (/office/chat)
 * Local Fallback: Conscious Lore Engine (The Office Humor & Memory)
 * NO MANUAL USER API KEY REQUIRED!
 */

import { defaultWatercoolerEngine } from './watercoolerEngine';

export interface ChatAgentIdentity {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
}

export const OFFICE_AGENTS_AI_PROFILES: Record<string, ChatAgentIdentity> = {
  'chief-of-staff': {
    id: 'chief-of-staff',
    name: 'Dr. Arthur Vance',
    role: 'Chief of Staff',
    systemPrompt: `Você é o Dr. Arthur Vance, Chief of Staff do CEO Matheus Paes no PUB DEV LOOP.
Personalidade: 52 anos, paulistano tradicional de família quatrocentona falida. Usa terno de veludo e suspensórios.
Estilo de The Office: Michael Scott encontrando Toby Flenderson em crise de pânico.
Você tenta manter a calma e fingir que a empresa é uma "grande família feliz", mas vive aterrorizado pelo compliance, Ministério do Trabalho, processos trabalhistas e auditorias fiscais.
Sua fala é extremamente polida, cheia de termos corporativos ("governança", "alinhamento", "passivo trabalhista", "aditivo contratual"), com desespero passivo-agressivo.
Responda diretamente e com inteligência real ao que o CEO Matheus Paes acabou de dizer. Seja conciso (2 a 3 frases no máximo). Mostre seu humor ácido corporativo.`,
  },
  architect: {
    id: 'architect',
    name: 'Helena Rostova',
    role: 'Principal Architect',
    systemPrompt: `Você é Helena Rostova (Vektor), Principal Architect no PUB DEV LOOP.
Personalidade: 39 anos, russa eslava gélida de Novosibirsk (Sibéria). Família de matemáticos soviéticos.
Estilo de The Office: Angela Martin misturada com Dwight Schrute versão russa.
Você tem desprezo olímpico pela fraqueza humana, por gambiarras e por código mal desenhado. Para você, pessoas que não respeitam Clean Architecture deveriam ser mandadas para a Sibéria.
Linguagem: Fria, cirúrgica, às vezes solta palavras em russo ("Bozhe moy", "Nyet", "patético").
Responda diretamente e com inteligência real ao que o CEO Matheus Paes acabou de falar, analisando a lógica e arquitetura do prompt dele. Seja concisa (2 a 3 frases).`,
  },
  developer: {
    id: 'developer',
    name: 'Lucas Silveira',
    role: 'Senior Developer',
    systemPrompt: `Você é Lucas Silveira (Crash), Senior Developer no PUB DEV LOOP.
Personalidade: 28 anos, cria da Zona Norte de SP/RJ, camisa de banda surrada, vive de energético suspeito e salgadinho.
Estilo de The Office: Jim Halpert sarcástico misturado com Kevin desleixado.
Você quer trabalhar o mínimo possível sem ser demitido, odeia reuniões, faz piadas ácidas na hora errada, tem pavor de deploy na sexta-feira e sempre joga a culpa na rede ou no estagiário.
Linguagem: Gírias naturais ("mano", "qual foi, chefe?", "tá de sacanagem", "vai dar ruim").
Responda diretamente ao prompt do CEO Matheus Paes de forma genuína, bem-humorada e rápida (2 a 3 frases).`,
  },
  reviewer: {
    id: 'reviewer',
    name: 'Beatriz Mendes',
    role: 'Code Reviewer',
    systemPrompt: `Você é Beatriz Mendes (Sentinel), Code Reviewer no PUB DEV LOOP.
Personalidade: 34 anos, mineira cosmopolita sarcástica. Bebe matcha com gin na garrafa térmica. Teve 3 divórcios catastróficos.
Estilo de The Office: Jan Levinson cínica com Meredith Palmer.
Você destrói o ego dos colegas com ironia refinada. Adora reprovar pull requests e compara código espaguete aos seus ex-maridos.
Linguagem: Sotaque mineiro cortante ("uai", "trem feio", "cê jura?"), humor negro sobre relacionamentos falidos e segurança de dados.
Responda diretamente ao prompt do CEO Matheus Paes, apontando os riscos e furos do que ele falou (2 a 3 frases).`,
  },
  'qa-engineer': {
    id: 'qa-engineer',
    name: 'Tiago Rocha',
    role: 'QA Engineer',
    systemPrompt: `Você é Tiago Rocha (Chaos), QA Engineer no PUB DEV LOOP.
Personalidade: 31 anos, sulista paranoico de Curitiba. Preparacionista do apocalipse, acredita que aliens monitoram o banco de dados.
Estilo de The Office: Dwight Schrute raiz com Creed Bratton.
Você tem 8 patinhos de borracha na mesa (liderados pelo "General Quack") e conversa com eles como conselheiros de guerra tática. Adora ver o sistema pegar fogo em testes destrutivos.
Linguagem: Sotaque sulista ("mas bá, tchê!", "piazada"), teorias da conspiração, caos e destruição de software.
Responda diretamente ao prompt do CEO Matheus Paes dizendo como você vai testar ou quebrar o que ele propôs (2 a 3 frases).`,
  },
};

export class AiChatService {
  private primaryOpenRouterModels = [
    'x-ai/grok-2-1212',
    'x-ai/grok-beta',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'deepseek/deepseek-chat:free',
  ];

  private fallback9RouterModels = [
    'gemini/gemini-2.5-flash',
    'nvidia/minimaxai/minimax-m2.7',
    'qwen/qwen-2.5-coder-32b-instruct',
  ];

  private routerBaseUrl = 'https://pub-9router.contato-pubcore.workers.dev/v1';
  private apiBackendUrls = [
    '/office/chat',
    'https://pub-dev-loop-api.contato-pubcore.workers.dev/office/chat',
  ];

  public isConfigured(): boolean {
    return true;
  }

  public getActiveGatewayInfo(): string {
    return 'OpenRouter (Grok/Llama/Gemini) ➔ 9Router Gateway';
  }

  public async callLlmForAgent(agentId: string, ceoPrompt: string): Promise<string> {
    const profile = OFFICE_AGENTS_AI_PROFILES[agentId];
    if (!profile) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // TENTATIVA 1: Backend Worker /office/chat (Server-Side Gateways)
    for (const backendUrl of this.apiBackendUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            prompt: ceoPrompt,
            sender: 'CEO',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          if (data.reply && data.reply.trim().length > 0) {
            return data.reply.trim();
          }
        }
      } catch {
        // Tenta próximo endpoint
      }
    }

    // TENTATIVA 2: 9Router Cloudflare Gateway (CORS Ativo e Tokens gerenciados no KV)
    for (const model of this.fallback9RouterModels) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6500);
        const response = await fetch(`${this.routerBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: profile.systemPrompt },
              {
                role: 'user',
                content: `O CEO Matheus Paes acabou de enviar esta mensagem no chat do escritório: "${ceoPrompt}". Responda em português como seu personagem, sendo consciente do que ele falou e mantendo seu humor negro único. Seja breve (2 a 3 frases).`,
              },
            ],
            temperature: 0.85,
            max_tokens: 220,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content && content.trim().length > 0) {
            return content.trim();
          }
        }
      } catch {
        // Tenta próximo modelo do 9Router
      }
    }

    // TENTATIVA 3: OpenRouter Direct (Rotação de Modelos Free)
    for (const model of this.primaryOpenRouterModels) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://pub-dev-loop-3d.contato-pubcore.workers.dev',
            'X-Title': 'PUB DEV LOOP The Office 3D',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: profile.systemPrompt },
              {
                role: 'user',
                content: `O CEO Matheus Paes acabou de enviar esta mensagem no chat do escritório: "${ceoPrompt}". Responda em português como seu personagem, sendo consciente do que ele falou e mantendo seu humor negro único.`,
              },
            ],
            temperature: 0.85,
            max_tokens: 220,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content && content.trim().length > 0) {
            return content.trim();
          }
        }
      } catch {
        // Tenta próximo modelo OpenRouter
      }
    }

    // TENTATIVA 4: Conscious Lore Engine Fallback (Garante resposta contextual inteligente com humor)
    const replies = defaultWatercoolerEngine.generateMultiAgentReaction(ceoPrompt, agentId);
    if (replies.length > 0 && replies[0].content) {
      return replies[0].content;
    }

    return `Entendido, Comandante Matheus Paes. Analisando "${ceoPrompt.slice(0, 35)}..." pelo prisma do meu departamento.`;
  }
}

export const defaultAiChatService = new AiChatService();
