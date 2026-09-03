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

const STORAGE_KEY = 'the_office_social_memories_v1';

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
   * Ciclo de diálogos espontâneos no café.
   */
  public getNextDialogue(): WatercoolerDialogue[] {
    const conversations: WatercoolerDialogue[][] = [
      [
        {
          speakerId: 'developer',
          content: 'Alguém acabou com o café da garrafa preta de novo? Eu tô codando em TypeScript puro há 4 horas sem cafeína, meu cérebro vai dar stack overflow.',
          topic: 'COFFEE',
        },
        {
          speakerId: 'qa-engineer',
          content: 'Eu vi a Beatriz pegando a última xícara enquanto dava reject em três PRs seus com um sorrisinho de lado, Lucas. 😂',
          topic: 'COFFEE',
        },
        {
          speakerId: 'reviewer',
          content: 'Se o Lucas tratasse o linter com o mesmo carinho que trata o café, a gente não teria 42 warnings de any no repo. E era chá verde, Tiago.',
          topic: 'RIVALRY',
        },
        {
          speakerId: 'chief-of-staff',
          content: 'Senhores, mantenham a compostura. Já solicitei uma nova remessa de grãos especiais para a copa. Foquem na entrega da sprint.',
          topic: 'COFFEE',
        },
      ],
      [
        {
          speakerId: 'architect',
          content: 'Lucas, acabei de inspecionar seu commit. Você instanciou o repositório direto dentro do controller sem passar pelo service layer?',
          topic: 'TECH_DEBATE',
        },
        {
          speakerId: 'developer',
          content: 'Helena, era um hotfix de 3 linhas pra resolver o timeout do WebSocket! Funciona, não quebra nada e subiu em 2 minutos!',
          topic: 'TECH_DEBATE',
        },
        {
          speakerId: 'architect',
          content: 'Uma "gambiarra de 3 linhas" hoje é o débito técnico de 3 semanas amanhã. A abstração precisa ser pura.',
          topic: 'TECH_DEBATE',
        },
        {
          speakerId: 'qa-engineer',
          content: 'Briguem mais que eu já estou preparando um teste de concorrência com 10.000 requisições simultâneas pra ver quem tem razão. 🍿',
          topic: 'RIVALRY',
        },
      ],
      [
        {
          speakerId: 'developer',
          content: 'Quem colocou essa Bossa Nova suave no toca-discos? Coloca um Synthwave anos 80 acelerado aí pra eu terminar esse pipeline!',
          topic: 'MUSIC',
        },
        {
          speakerId: 'chief-of-staff',
          content: 'Fui eu, Lucas. Tom Jobim estimula a sinapse executiva e acalma os nervos do escritório. Menos decibéis, mais produtividade.',
          topic: 'MUSIC',
        },
        {
          speakerId: 'reviewer',
          content: 'Eu concordo com o Dr. Arthur. Dark Ambient e Bossa Nova reduzem a taxa de bugs em 28%. Heavy Metal só gera pull request afobado.',
          topic: 'MUSIC',
        },
        {
          speakerId: 'architect',
          content: 'Coloquem Brian Eno ou Kraftwerk e todos os nossos problemas de acoplamento desaparecerão.',
          topic: 'MUSIC',
        },
      ],
      [
        {
          speakerId: 'qa-engineer',
          content: 'Passando pra avisar que testei o campo de busca com 50.000 caracteres em hebraico clássico e um emoji de berinjela. O servidor retornou status 418 I am a teapot. 🦆',
          topic: 'TECH_DEBATE',
        },
        {
          speakerId: 'developer',
          content: 'TIAGO, POR QUÊ?! Quem em sã consciência vai pesquisar 50 mil caracteres em hebraico na barra de busca do app?!',
          topic: 'TECH_DEBATE',
        },
        {
          speakerId: 'qa-engineer',
          content: 'O usuário, Lucas. O usuário é uma força da natureza. Se pode dar crash, vai dar crash.',
          topic: 'TECH_DEBATE',
        },
        {
          speakerId: 'reviewer',
          content: 'Ponto pro Tiago. Faltava validação de tamanho de payload no middleware. Já bloqueei a branch.',
          topic: 'RIVALRY',
        },
      ],
    ];

    const dialogue = conversations[this.lastDialogueIndex % conversations.length];
    this.lastDialogueIndex++;
    return dialogue;
  }

  /**
   * Responde ao CEO gerando uma THREAD MULTI-AGENTE realista e personalizada.
   */
  public generateMultiAgentReaction(
    ceoText: string,
    targetAgentId?: string
  ): PersonaReply[] {
    const textLower = ceoText.toLowerCase();

    // 1. Tópico: PISCINA / PRAIA / CALOR / FÉRIAS / LAZER
    if (textLower.includes('piscina') || textLower.includes('praia') || textLower.includes('calor') || textLower.includes('férias') || textLower.includes('nadar')) {
      this.saveMemory('Lazer & Piscina', ceoText, 'Lucas quis codar na água, Tiago quis levar os patos');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Piscina no calor é lei, Comandante! Se tiver uma tomada perto pra eu levar o notebook, botar um Synthwave no fone e codar com o pé na água, eu fecho na hora! 🏊‍♂️💻',
          delayMs: 400,
        },
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: 'Água e circuitos elétricos de alta performance são conceitualmente incompatíveis, Lucas. Mas uma piscina olímpica com silêncio total para projetar arquiteturas distribuídas seria aceitável.',
          delayMs: 1800,
        },
        {
          speakerId: 'qa-engineer',
          senderName: 'Tiago Rocha',
          senderRole: 'QA Engineer',
          content: 'PISCINA?! Só vou se eu puder levar minha esquadrilha de 8 patinhos de borracha pra testar flutuabilidade e hidrodinâmica extrema! 🦆🌊',
          delayMs: 3200,
        },
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: 'Por mim tudo bem, desde que ninguém invente de fazer code review com o notebook molhado. E mantenham o Lucas longe da fiação da bomba da piscina.',
          delayMs: 4600,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Excelente iniciativa de integração, CEO. Se aumentar a moral da equipe sem violar o cronograma de entregas, posso incluir a reserva no orçamento de bem-estar corporativo.',
          delayMs: 6000,
        },
      ];
    }

    // 2. Tópico: COMIDA / ALMOÇO / PIZZA / CERVEJA / CAFÉ / HAMBÚRGUER
    if (textLower.includes('almoço') || textLower.includes('pizza') || textLower.includes('café') || textLower.includes('cerveja') || textLower.includes('hambúrguer') || textLower.includes('comer') || textLower.includes('fome')) {
      this.saveMemory('Comida & Copa', ceoText, 'Debate de cardápio e conta');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Falou de comida eu largo o VS Code na hora! Pizza de quatro queijos com bacon e refrigerante trincando de gelado pra pagar o hotfix de ontem!',
          delayMs: 400,
        },
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: 'Lembrando que o Lucas perdeu a aposta do último bug em produção e prometeu que ia pagar a rodada de pizza para o time inteiro.',
          delayMs: 1800,
        },
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: 'Eu prefiro uma salada mediterrânea e chá Earl Grey sem açúcar. Carboidratos pesados causam lentidão cognitiva e tolerância a código espaguete.',
          delayMs: 3200,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Aprovado pelo comitê executivo. Almoço de alinhamento estimula a sinergia. Só não estendam o horário para não atrasar o deploy das 15h.',
          delayMs: 4600,
        },
      ];
    }

    // 3. Tópico: TRABALHO NO SÁBADO / HORA EXTRA / SALÁRIO / AUMENTO
    if (textLower.includes('sábado') || textLower.includes('domingo') || textLower.includes('hora extra') || textLower.includes('aumento') || textLower.includes('salário') || textLower.includes('plantão')) {
      this.saveMemory('Trabalho & Compensação', ceoText, 'Discussão de horas e bonificação');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Sábado?! Só se for regado a energético em dobro e com um bônus gordo pra eu trocar minha placa de vídeo, Comandante! 💸⚡',
          delayMs: 400,
        },
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: 'Deploy no final de semana é a receita clássica para passar o domingo apagando incêndio. Se for indispensável, revisarei com rigor triplo.',
          delayMs: 1800,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Comandante, a governança recomenda descanso adequado para preservar a acuidade cognitiva. Mas se for uma diretriz estratégica, ajustarei as escalas com compensação justa.',
          delayMs: 3200,
        },
      ];
    }

    // 4. Tópico: MÚSICA / TOCA-DISCOS / ROCK / JAZZ / SYNTHWAVE
    if (textLower.includes('música') || textLower.includes('toca disco') || textLower.includes('vinil') || textLower.includes('rock') || textLower.includes('jazz') || textLower.includes('som') || textLower.includes('lofi')) {
      this.saveMemory('Música & Lounge', ceoText, 'Gosto musical do time');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Coloca o disco do Crash Silveira Band no talo! Synthwave e Rock aceleram a digitação em pelo menos 40%!',
          delayMs: 400,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Um clássico do Tom Jobim ou Miles Davis no toca-discos de vinil traz a sofisticação e a clareza que este escritório merece.',
          delayMs: 1800,
        },
        {
          speakerId: 'qa-engineer',
          senderName: 'Tiago Rocha',
          senderRole: 'QA Engineer',
          content: 'Eu voto na trilha 8-bit de arcade! Meus patinhos entram em sincronia rítmica perfeita com chiptune!',
          delayMs: 3200,
        },
      ];
    }

    // 5. Tópico: ELOGIOS / BOM DIA / TIME / VALEU
    if (textLower.includes('bom dia') || textLower.includes('boa tarde') || textLower.includes('parabéns') || textLower.includes('valeu') || textLower.includes('orgulho') || textLower.includes('show') || textLower.includes('excelente')) {
      this.saveMemory('Afeto & Clima', ceoText, 'Elogio do CEO ao time');
      return [
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Muito obrigado pelas palavras, CEO Matheus! A equipe inteira está engajada e pronta para entregar resultados excepcionais.',
          delayMs: 400,
        },
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Tamo junto, Comandante! O pipeline tá verde, os testes tão voando e o café tá no sangue. Pra cima deles! 🚀',
          delayMs: 1800,
        },
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: 'Agradeço o reconhecimento. Manter o código limpo e arquitetado é um compromisso diário com a excelência do PUB DEV LOOP.',
          delayMs: 3200,
        },
        {
          speakerId: 'qa-engineer',
          senderName: 'Tiago Rocha',
          senderRole: 'QA Engineer',
          content: 'Valeu, chefe! E não se preocupe: se existir algum bug escondido, meus patinhos farejam antes do deploy! 🦆✨',
          delayMs: 4600,
        },
      ];
    }

    // 6. SE O CEO MIRAR UM AGENTE ESPECÍFICO
    if (targetAgentId === 'chief-of-staff' || textLower.includes('arthur')) {
      return [
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: `Diretriz anotada, Comandante. "Alinhamento e governança evitam retrabalho". Estou monitorando a esteira e os 4 especialistas para assegurar execução impecável.`,
          delayMs: 300,
        },
      ];
    }

    if (targetAgentId === 'architect' || textLower.includes('helena')) {
      return [
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: `Excelente apontamento, Matheus. Garantir que as interfaces e os contratos sejam imutáveis é o que separa um software profissional de um castelo de cartas.`,
          delayMs: 300,
        },
      ];
    }

    if (targetAgentId === 'developer' || textLower.includes('lucas')) {
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: `Pode deixar comigo, Comandante! Já abri a branch, tomei um gole de energético e tô focado no código a 120 WPM!`,
          delayMs: 300,
        },
      ];
    }

    if (targetAgentId === 'reviewer' || textLower.includes('beatriz')) {
      return [
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: `Comandante, atenta a cada detalhe. Nenhuma brecha de segurança ou tipagem frágil passará despercebida pela Sentinel.`,
          delayMs: 300,
        },
      ];
    }

    if (targetAgentId === 'qa-engineer' || textLower.includes('tiago')) {
      return [
        {
          speakerId: 'qa-engineer',
          senderName: 'Tiago Rocha',
          senderRole: 'QA Engineer',
          content: `Já preparei a bateria de testes de estresse! Se tiver um caso de borda esquecido, eu quebro agora mesmo! 🦆⚡`,
          delayMs: 300,
        },
      ];
    }

    // 7. CONVERSAÇÃO DINÂMICA / DEBATE GERAL (SE NÃO CAIR EM NENHUM TÓPICO ANTERIOR)
    // O time debate a frase exata do CEO com suas lentes de mundo!
    this.saveMemory('Debate Geral', ceoText, 'Debate espontâneo entre especialistas');
    const pastMemorySnippet = this.socialMemories.length > 2
      ? ` (Lembrando que mais cedo você mencionou sobre "${this.socialMemories[this.socialMemories.length - 2].topic}")`
      : '';

    return [
      {
        speakerId: 'developer',
        senderName: 'Lucas Silveira',
        senderRole: 'Senior Developer',
        content: `Olha, ouvindo isso que o CEO falou sobre "${ceoText.slice(0, 40)}...", minha primeira reação é abrir o editor e ver se a gente consegue prototipar rápido!`,
        delayMs: 400,
      },
      {
        speakerId: 'architect',
        senderName: 'Helena Rostova',
        senderRole: 'Principal Architect',
        content: `Calma, Lucas. Antes de escrever uma única linha, precisamos modelar os domínios e garantir que a proposta do CEO se encaixe na nossa arquitetura limpa.`,
        delayMs: 1800,
      },
      {
        speakerId: 'qa-engineer',
        senderName: 'Tiago Rocha',
        senderRole: 'QA Engineer',
        content: `E eu já estou aqui pensando em como vou bolar 50 testes malucos pra estressar essa ideia!${pastMemorySnippet} 🦆`,
        delayMs: 3200,
      },
      {
        speakerId: 'chief-of-staff',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff',
        content: `Concordo com os pontos. A visão do CEO Matheus sempre traz novas perspectivas estratégicas. Vou estruturar o plano de ação.`,
        delayMs: 4600,
      },
    ];
  }

  /**
   * Resposta única para compatibilidade com testes e legado.
   */
  public respondToCeo(
    ceoText: string,
    targetAgentId?: string
  ): { speakerId: string; senderName: string; senderRole: string; content: string } {
    const replies = this.generateMultiAgentReaction(ceoText, targetAgentId);
    return replies[0];
  }
}

export const defaultWatercoolerEngine = new WatercoolerEngine();
