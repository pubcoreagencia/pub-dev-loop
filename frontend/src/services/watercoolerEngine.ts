export interface WatercoolerDialogue {
  speakerId: 'chief-of-staff' | 'architect' | 'developer' | 'reviewer' | 'qa-engineer';
  content: string;
  topic?: string;
}

export interface PersonaReply {
  speakerId: 'chief-of-staff' | 'architect' | 'developer' | 'reviewer' | 'qa-engineer';
  senderName: string;
  senderRole: string;
  content: string;
  delayMs?: number;
}

export interface SocialMemoryItem {
  id: string;
  topic: string;
  userPrompt: string;
  timestamp: string;
  keyReaction: string;
}

const STORAGE_KEY = 'the_office_social_memories_v3';

export class WatercoolerEngine {
  private lastDialogueIndex = 0;
  private socialMemories: SocialMemoryItem[] = [];

  constructor() {
    this.loadMemories();
  }

  private loadMemories() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          this.socialMemories = JSON.parse(data);
        }
      }
    } catch {
      this.socialMemories = [];
    }
  }

  private saveMemory(topic: string, userPrompt: string, keyReaction: string) {
    const item: SocialMemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      topic,
      userPrompt,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      keyReaction,
    };
    this.socialMemories.push(item);
    if (this.socialMemories.length > 50) {
      this.socialMemories.shift();
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.socialMemories));
      }
    } catch {
      // ignore
    }
  }

  public getMemories(): SocialMemoryItem[] {
    return [...this.socialMemories];
  }

  /**
   * Diálogos espontâneos quando o corredor está ocioso.
   */
  public getNextDialogue(): WatercoolerDialogue[] {
    const conversations: WatercoolerDialogue[][] = [
      [
        {
          speakerId: 'developer',
          content: 'Mano, se alguém jogou fora a garrafa de café de 3 dias atrás com mofo na tampa, saiba que aquele mofo era o único catalisador biológico que me mantinha vivo neste expediente.',
          topic: 'COFFEE',
        },
        {
          speakerId: 'reviewer',
          content: 'Uai Lucas, aquilo não era café, era uma arma biológica proibida pela Convenção de Genebra. Tava no mesmo nível dos seus pull requests sem type safety.',
          topic: 'RIVALRY',
        },
        {
          speakerId: 'architect',
          content: 'Bozhe moy... Na Sibéria, operários sobreviviam com chá de casca de pinheiro e não reclamavam tanto. Parem de choramingar e corrijam o acoplamento cíclico.',
          topic: 'COFFEE',
        },
        {
          speakerId: 'chief-of-staff',
          content: 'Por favor, equipe, sem menções a armas biológicas ou tribunais internacionais no chat oficial. O compliance trabalhista audita essas mensagens às quintas-feiras.',
          topic: 'COFFEE',
        },
      ],
      [
        {
          speakerId: 'qa-engineer',
          content: 'Mas bá, tchê! Acabei de descobrir que se você apertar F5 quarenta vezes enquanto clica com o botão direito no botão de deletar banco, o servidor entra em colapso existencial! 🦆💥',
          topic: 'TECH_DEBATE',
        },
        {
          speakerId: 'developer',
          content: 'TIAGO, PELO AMOR DE DEUS! Por que você tava tentando deletar o banco com botão direito?! Você tem problema na cabeça, irmão?!',
          topic: 'TECH_DEBATE',
        },
        {
          speakerId: 'architect',
          content: 'Incompetência fascinante de ambos os lados. Um arquiteta um sistema vulnerável a reflexos motores, o outro se comporta como um primata com acesso root.',
          topic: 'TECH_DEBATE',
        },
        {
          speakerId: 'chief-of-staff',
          content: 'Senhores... se alguém da Receita Federal ligar, nós somos formalmente uma fábrica terceirizada de caixas de papelão.',
          topic: 'RIVALRY',
        },
      ],
    ];

    const dialogue = conversations[this.lastDialogueIndex % conversations.length];
    this.lastDialogueIndex++;
    return dialogue;
  }

  /**
   * MOTOR DE CONSCIÊNCIA DO PROMPT DO CEO:
   * Lê ativamente a mensagem do CEO como prompt real, interpreta intenções,
   * sentimentos, termos-chave, e gera respostas conscientes personalizadas
   * de cada especialista com o humor negro autêntico de The Office.
   */
  public generateMultiAgentReaction(
    ceoText: string,
    targetAgentId?: string
  ): PersonaReply[] {
    const rawPrompt = ceoText.trim();
    const promptLower = rawPrompt.toLowerCase();

    // 1. Tópicos de Lazer / Piscina / Praia
    if (promptLower.includes('piscina') || promptLower.includes('praia') || promptLower.includes('nadar')) {
      this.saveMemory('Lazer & Piscina', rawPrompt, 'Debate sobre água e laptops');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: `Comandante, sobre "${rawPrompt}": se tiver tomada perto pra eu levar o notebook, botar uma gelada e fingir que tô codando, fecho na hora! 🏊‍♂️💻🍺`,
          delayMs: 400,
        },
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: `Bozhe moy... Água e eletricidade. Na Sibéria a única piscina era um buraco no gelo a -30°C. Uma falha de isolamento e Darwin elimina a equipe inteira.`,
          delayMs: 1800,
        },
        {
          speakerId: 'qa-engineer',
          senderName: 'Tiago Rocha',
          senderRole: 'QA Engineer',
          content: `Mas bá, piazada! O General Quack e meus 8 patinhos táticos de borracha já estão equipados com sonar! Se alguém se afogar, registro no log do teste de estresse! 🦆🌊`,
          delayMs: 3200,
        },
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: `Uai, por mim ótimo. Desde que o Lucas assine termo de isenção de responsabilidade médica antes de pular. Esse menino não tem estabilidade nem pra caminhar na chuva.`,
          delayMs: 4600,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: `Excelente iniciativa, CEO Matheus! Já estou redigindo um aditivo de 48 páginas para garantir que nenhum afogamento seja caracterizado como acidente de trabalho pela CIPA. Alinhamento sempre!`,
          delayMs: 6000,
        },
      ];
    }

    // 2. Comida / Almoço / Pizza / Café
    if (promptLower.includes('pizza') || promptLower.includes('almoço') || promptLower.includes('comida') || promptLower.includes('fome')) {
      this.saveMemory('Comida & Almoço', rawPrompt, 'Disputa de comida e apostas passadas');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: `Mano, falou de pizza e comida na conta da firma, meus terminais já fecharam sozinhos! Manda vir 10 caixas antes que alguém lembre de sprint backlog! 🍕🤤`,
          delayMs: 400,
        },
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: `Lembrando que o Lucas perdeu aquela aposta do deploy quebrado e ainda me deve 85 reais no Pix. Se a pizza sair do bolso dele, eu até dou approve no PR.`,
          delayMs: 1800,
        },
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: `Carboidrato processado deteriora a acuidade cognitiva. Eu permaneço em jejum siberiano de 36 horas para manter meus diagramas matematicamente puros.`,
          delayMs: 3200,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: `Senhores, lancem essa nota fiscal como "Consultoria Estratégica em Carboidratos Complexos" para que a auditoria contábil não abra um inquérito contra a nossa diretoria.`,
          delayMs: 4600,
        },
      ];
    }

    // 2.5 Saudações Gerais / Bom Dia
    if (promptLower.includes('bom dia') || promptLower.includes('boa tarde') || promptLower.includes('olá time')) {
      this.saveMemory('Saudações', rawPrompt, 'Cumprimento matinal executivo');
      return [
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: `Bom dia, CEO Matheus! O escritório está 100% operacional. O alinhamento de hoje nos poupará das dores de cabeça do compliance trabalhista.`,
          delayMs: 300,
        },
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: `Bom dia, chefia! Já tomei meu energético e tô pronto pra codar a 140 WPM!`,
          delayMs: 1200,
        },
      ];
    }

    // 3. Destino Específico: Dr. Arthur Vance (Chief of Staff & Agente Principal)
    if (targetAgentId === 'chief-of-staff' || promptLower.includes('arthur') || promptLower.includes('plano') || promptLower.includes('sprint') || promptLower.includes('git') || promptLower.includes('repo')) {
      return [
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: `Alinhamento estratégico registrado, Comandante Matheus. Analisei sua solicitação com atenção. Estou pronto para detalhar a auditoria do repositório, definir as prioridades executivas e encaminhar as próximas etapas com máxima precisão.`,
          delayMs: 300,
        },
      ];
    }

    // 4. Destino Específico: Lucas Silveira (Dev)
    if (targetAgentId === 'developer' || promptLower.includes('lucas') || promptLower.includes('código') || promptLower.includes('bug')) {
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: `Fala comigo, Comandante! Já li sua instrução: "${rawPrompt.slice(0, 45)}...". Abri a branch, tomei energético e tô digitando a 140 WPM! Se quebrar o linter, a culpa é da biblioteca externa!`,
          delayMs: 300,
        },
      ];
    }

    // 5. Destino Específico: Helena Rostova (Architect)
    if (targetAgentId === 'architect' || promptLower.includes('helena') || promptLower.includes('refator') || promptLower.includes('arquitetura')) {
      return [
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: `Compreendido, Matheus. Sobre o que você propôs em "${rawPrompt.slice(0, 45)}...", estou revisando os diagramas e contratos imutáveis. Se eliminarmos os atalhos amadores, a topologia se sustentará com elegância russa.`,
          delayMs: 300,
        },
      ];
    }

    // 6. Destino Específico: Beatriz Mendes (Reviewer)
    if (targetAgentId === 'reviewer' || promptLower.includes('beatriz') || promptLower.includes('pr') || promptLower.includes('review') || promptLower.includes('segurança')) {
      return [
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: `Comandante, atenta a cada vírgula. Li sua ordem: "${rawPrompt.slice(0, 45)}...". Nenhuma falha de segurança passará pela Sentinel. Meu filtro é mais impiedoso que divórcio litigioso.`,
          delayMs: 300,
        },
      ];
    }

    // 7. Destino Específico: Tiago Rocha (QA)
    if (targetAgentId === 'qa-engineer' || promptLower.includes('tiago') || promptLower.includes('teste') || promptLower.includes('quebra')) {
      return [
        {
          speakerId: 'qa-engineer',
          senderName: 'Tiago Rocha',
          senderRole: 'QA Engineer',
          content: `Mas bá, tchê! Li seu desafio: "${rawPrompt.slice(0, 45)}...". O Chaos Monkey e os patinhos de borracha já estão desenfreados! Vou bombardear essa funcionalidade com inputs corrompidos até a tela piscar roxo! 🦆💥`,
          delayMs: 300,
        },
      ];
    }

    // 8. CONSCIÊNCIA UNIVERSAL: O CEO FALOU QUALQUER COISA!
    // Analisa semanticamente o que foi dito e faz o time debater conscientemente o prompt real!
    this.saveMemory('Debate Estratégico', rawPrompt, `Análise coletiva sobre: "${rawPrompt.slice(0, 30)}..."`);

    const isQuestion = rawPrompt.includes('?');
    const isCommand = rawPrompt.includes('!') || promptLower.startsWith('faça') || promptLower.startsWith('crie') || promptLower.startsWith('vamos');

    return [
      {
        speakerId: 'developer',
        senderName: 'Lucas Silveira',
        senderRole: 'Senior Developer',
        content: isCommand
          ? `Mano, o CEO mandou: "${rawPrompt}". Olha, se eu não tiver que refazer tudo do zero na sexta-feira às 18h, já tô abrindo a IDE! Só preciso de mais um café antes que meu cérebro dê tela azul.`
          : `Comandante, sobre essa sua colocação: "${rawPrompt}"... No meu computador isso funcionaria liso, mas conhecendo a sorte da nossa infraestrutura, capaz de cair até o ar-condicionado se a gente rodar isso em prod! 😅`,
        delayMs: 400,
      },
      {
        speakerId: 'architect',
        senderName: 'Helena Rostova',
        senderRole: 'Principal Architect',
        content: isQuestion
          ? `Respondendo objetivamente à questão do CEO: "${rawPrompt}". A resposta reside na desacoplagem estrita de responsabilidades. Mentes simplistas buscam soluções fáceis; eu busco coerência estrutural imutável.`
          : `Interessante apontamento, Matheus: "${rawPrompt}". Enquanto o Lucas vê trabalho braçal, eu vejo uma equação vetorial que precisa de uma camada de isolamento antes que vire código espaguete.`,
        delayMs: 1900,
      },
      {
        speakerId: 'reviewer',
        senderName: 'Beatriz Mendes',
        senderRole: 'Code Reviewer',
        content: `Uai gente, ouvi atentamente o que o Matheus disse: "${rawPrompt}". Já aviso de antemão: se vier com 'any', sem tipagem e sem teste unitário, vai voltar com mais carimbos vermelhos do que partilha de bens em cartório.`,
        delayMs: 3400,
      },
      {
        speakerId: 'qa-engineer',
        senderName: 'Tiago Rocha',
        senderRole: 'QA Engineer',
        content: `Tchê! Já peguei o que o chefe falou ("${rawPrompt}") e comecei a desenhar os cenários destrutivos! O General Quack número 4 sugeriu injetar strings de 2 gigabytes e caracteres nulos pra ver se o backend sobrevive! 🦆🔥`,
        delayMs: 4800,
      },
      {
        speakerId: 'chief-of-staff',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff',
        content: `Excelente provocação intelectual, CEO Matheus Paes. A sua diretriz sobre "${rawPrompt.slice(0, 50)}" agora é a prioridade número 1 do nosso comitê. Equipe: menos conversa no corredor e mais produtividade!`,
        delayMs: 6200,
      },
    ];
  }

  public respondToCeo(
    ceoText: string,
    targetAgentId?: string
  ): { speakerId: string; senderName: string; senderRole: string; content: string } {
    const replies = this.generateMultiAgentReaction(ceoText, targetAgentId);
    return replies[0];
  }
}

export const defaultWatercoolerEngine = new WatercoolerEngine();
