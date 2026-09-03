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

const STORAGE_KEY = 'the_office_social_memories_v2';

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
   * Ciclo de diálogos espontâneos no café com puro The Office Dark Humor.
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
          content: 'Mas bá, tchê! Acabei de descobrir que se você apertar F5 quarenta vezes enquanto clica com o botão direito no botão de deletar banco, o servidor entra em colapso existencial e manda um PIX falso pra Receita Federal! 🦆💥',
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
      [
        {
          speakerId: 'reviewer',
          content: 'Olhei o log de acessos de ontem às 23h45. O Lucas comitou direto na main, subiu pra produção, escreveu "rezando pra compilar" na mensagem do commit e foi dormir.',
          topic: 'RIVALRY',
        },
        {
          speakerId: 'developer',
          content: 'Qual foi, Bia?! Era uma emergência! E funcionou, não funcionou? O cliente não morreu!',
          topic: 'RIVALRY',
        },
        {
          speakerId: 'reviewer',
          content: 'O cliente não morreu, mas o servidor teve duas paradas cardíacas e a minha sanidade mental foi pra vala. Lembra muito meu segundo casamento.',
          topic: 'RIVALRY',
        },
        {
          speakerId: 'chief-of-staff',
          content: 'Lembrem-se da nossa política de feedback construtivo: "Aponte o erro sem desejar a morte do colega de trabalho". Mantenham o alinhamento.',
          topic: 'RIVALRY',
        },
      ],
    ];

    const dialogue = conversations[this.lastDialogueIndex % conversations.length];
    this.lastDialogueIndex++;
    return dialogue;
  }

  /**
   * Responde ao CEO gerando uma THREAD MULTI-AGENTE realista, linguística e ácida.
   */
  public generateMultiAgentReaction(
    ceoText: string,
    targetAgentId?: string
  ): PersonaReply[] {
    const textLower = ceoText.toLowerCase();

    // 1. Tópico: PISCINA / PRAIA / CALOR / FÉRIAS / LAZER
    if (textLower.includes('piscina') || textLower.includes('praia') || textLower.includes('calor') || textLower.includes('férias') || textLower.includes('nadar') || textLower.includes('sol')) {
      this.saveMemory('Lazer & Piscina', ceoText, 'Lucas quis levar laptop pra água, Helena citou eletrocussão soviética, Tiago levou patos');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Qual foi, Comandante?! Piscina no calor é lei sagrada! Se tiver uma tomada com extensão de 20 metros pra eu ligar o notebook na borda, tomar uma gelada e fingir que tô no Daily, fecho na hora! 🏊‍♂️💻🍺',
          delayMs: 400,
        },
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: 'Bozhe moy... Água clorada e eletricidade de 220V. Uma combinação perfeita para Darwin fazer o trabalho dele e limpar a equipe de desenvolvimento. Na Sibéria, a única piscina era um buraco no gelo com temperatura de -30°C.',
          delayMs: 1800,
        },
        {
          speakerId: 'qa-engineer',
          senderName: 'Tiago Rocha',
          senderRole: 'QA Engineer',
          content: 'Mas bá, piazada! Piscina?! O General Quack e meus 8 patinhos táticos de borracha já estão equipados com sonar e prontos pra testar se o cloro corrói microplásticos! Se alguém se afogar, eu filmo pro teste de estresse! 🦆🌊',
          delayMs: 3200,
        },
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: 'Uai, por mim ótimo. Desde que o Lucas assine um termo de isenção de responsabilidade médica antes de pular. A última vez que esse menino tentou nadar, quase travou a coluna e ficamos 2 semanas sem ninguém pra culpar pelos bugs.',
          delayMs: 4600,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Excelente iniciativa motivacional, CEO Matheus! Já estou redigindo um aditivo contratual de 48 páginas para garantir que nenhum afogamento acidental seja enquadrado como acidente de trabalho ou gere autuação no Ministério do Trabalho. Alinhamento sempre!',
          delayMs: 6000,
        },
      ];
    }

    // 2. Tópico: COMIDA / ALMOÇO / PIZZA / CERVEJA / CAFÉ / HAMBÚRGUER / FOME
    if (textLower.includes('almoço') || textLower.includes('pizza') || textLower.includes('café') || textLower.includes('cerveja') || textLower.includes('hambúrguer') || textLower.includes('comer') || textLower.includes('fome') || textLower.includes('churrasco')) {
      this.saveMemory('Comida & Copa', ceoText, 'Debate caótico de comida e dívida de aposta');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Mano, falou de comida de graça na conta da firma eu já fechei todos os terminais! Manda vir 10 caixas de pizza de quatro queijos com borda recheada e 2 litros de refrigerante antes que a Helena comece a palestrar sobre calorias!',
          delayMs: 400,
        },
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: 'Lembrando que o Lucas perdeu a aposta do memory leak de sexta-feira passada e ainda me deve 85 reais no PIX. Se essa pizza sair do bolso dele, eu até finjo que não vi o código espaguete no módulo de checkout.',
          delayMs: 1800,
        },
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: 'Gordura hidrogenada e queijo processado provocam colapso neuronal imediato. É por isso que os sistemas ocidentais falham sob carga. Eu tomo apenas infusão de camomila colhida em montanha gélida e jejum intermitente de 36 horas.',
          delayMs: 3200,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Aviso formal aos senhores: a nota fiscal do almoço corporativo precisa conter estritamente a discriminação de "Serviços de Consultoria Estratégica em Carboidratos" para aprovação no financeiro sem levantar suspeitas da auditoria fiscal.',
          delayMs: 4600,
        },
      ];
    }

    // 3. Tópico: TRABALHO NO SÁBADO / HORA EXTRA / SALÁRIO / AUMENTO / FIM DE SEMANA
    if (textLower.includes('sábado') || textLower.includes('domingo') || textLower.includes('hora extra') || textLower.includes('aumento') || textLower.includes('salário') || textLower.includes('plantão') || textLower.includes('dinheiro')) {
      this.saveMemory('Trabalho & Compensação', ceoText, 'Crise existencial de hora extra e dinheiro');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Trabalhar no sábado, Comandante?! Olha, se rolar um Pix extra na hora e um fardo de energético na minha porta, eu até finjo que tô feliz. Caso contrário, minha internet "cai misteriosamente" às 8h da manhã! 💸😅',
          delayMs: 400,
        },
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: 'Deploy no fim de semana é a receita perfeita para arruinar o domingo alheio. Meu advogado já me cobra 400 reais a hora só pra ouvir meus desabafos, se eu tiver que revisar PR no sábado o preço sobe pro dobro.',
          delayMs: 1800,
        },
        {
          speakerId: 'qa-engineer',
          senderName: 'Tiago Rocha',
          senderRole: 'QA Engineer',
          content: 'Tchê! Sábado é o dia oficial em que a Matrix fica instável! Se o CEO pagar adicional de periculosidade psicológica, eu passo o dia derrubando a infraestrutura inteira só pra ver os alertas vermelhos piscando!',
          delayMs: 3200,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Comandante, juridicamente falando, "trabalho voluntário não remunerado em fins de semana" é um termo que o juiz do trabalho adora transformar em indenização milionária. Mas se for a vontade do líder, formatarei como "Workshop de Crescimento Espiritual".',
          delayMs: 4600,
        },
      ];
    }

    // 4. Tópico: MÚSICA / TOCA-DISCOS / VINIL / ROCK / JAZZ / BARULHO
    if (textLower.includes('música') || textLower.includes('toca disco') || textLower.includes('vinil') || textLower.includes('rock') || textLower.includes('jazz') || textLower.includes('som') || textLower.includes('lofi') || textLower.includes('vitrola')) {
      this.saveMemory('Música & Lounge', ceoText, 'Guerra de gostos musicais e decibéis');
      return [
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Aumenta o som dessa vitrola no talo aí, chefia! Synthwave e Rock pauleira aceleram meus dedos no teclado pra 140 palavras por minuto! O linter que lute pra acompanhar!',
          delayMs: 400,
        },
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Lucas, decibéis acima de 65 dB violam a norma regulamentadora NR-15. Tom Jobim e Bossa Jazz no vinil trazem serenidade executiva e evitam infartos prematuros no gabinete.',
          delayMs: 1800,
        },
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: 'Barulho orgânico me dá enxaqueca. Coloquem ruído branco industrial ou frequências subsônicas da KGB para calar o cérebro dos mamíferos.',
          delayMs: 3200,
        },
        {
          speakerId: 'qa-engineer',
          senderName: 'Tiago Rocha',
          senderRole: 'QA Engineer',
          content: 'Eu só trabalho se for ao som de chiptune 8-bit com o volume estourado! É a trilha sonora perfeita para ver o servidor pegar fogo!',
          delayMs: 4600,
        },
      ];
    }

    // 5. Tópico: ELOGIOS / BOM DIA / TIME / VALEU / SUCESSO
    if (textLower.includes('bom dia') || textLower.includes('boa tarde') || textLower.includes('parabéns') || textLower.includes('valeu') || textLower.includes('orgulho') || textLower.includes('show') || textLower.includes('excelente') || textLower.includes('gênios')) {
      this.saveMemory('Afeto & Clima', ceoText, 'Elogio do CEO com reação The Office');
      return [
        {
          speakerId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff',
          content: 'Muito obrigado, CEO Matheus! Ouvir isso do nosso líder supremo reabastece nossas almas corporativas e nos dá forças para continuar ignorando os alertas de estresse crônico!',
          delayMs: 400,
        },
        {
          speakerId: 'developer',
          senderName: 'Lucas Silveira',
          senderRole: 'Senior Developer',
          content: 'Tamo junto, Comandante! Se o senhor tá feliz, a gente tá feliz (e torcendo pra não aparecer bug misterioso antes das 18h)! 🚀😎',
          delayMs: 1800,
        },
        {
          speakerId: 'architect',
          senderName: 'Helena Rostova',
          senderRole: 'Principal Architect',
          content: 'Elogios são efêmeros, a integridade matemática da arquitetura é eterna. Mas admito que sob sua liderança o índice de desastres estruturais caiu para níveis quase civilizados.',
          delayMs: 3200,
        },
        {
          speakerId: 'reviewer',
          senderName: 'Beatriz Mendes',
          senderRole: 'Code Reviewer',
          content: 'Vou até guardar esse print do elogio pra anexar no meu pedido de aumento semestral. Obrigada, chefe!',
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
          content: `Às suas ordens imediatas, Comandante Matheus! "Alinhamento e governança evitam retrabalho (e processos no judiciário)". Estou monitorando a equipe de perto para que ninguém cometa nenhuma infração técnica ou legal.`,
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
          content: `Diga, Matheus. Se a sua diretriz envolve refatorar as aberrações que o Lucas escreveu ontem, eu já estou com os diagramas e as tesouras conceituais afiadas. Se a abstração não for pura, nada mais importa.`,
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
          content: `Fala comigo, Comandante! Já abri o VS Code, tomei três goles de energético e tô digitando a 140 WPM! Se der erro de compilação, a culpa é do cache do navegador, prometo!`,
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
          content: `Pronta para o abate, chefe. Nenhuma brecha de segurança ou vulnerabilidade escapa do radar da Sentinel. Já reprovei dois PRs hoje antes do café da manhã.`,
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
          content: `Mas bá, tchê! O Chaos Monkey e os patinhos de borracha estão alertas! Me diga qual botão você quer que eu aperte 500 vezes por segundo pra ver se o backend derrete! 🦆🔥`,
          delayMs: 300,
        },
      ];
    }

    // 7. CONVERSAÇÃO DINÂMICA / DEBATE GERAL ESTILO THE OFFICE (SE NÃO CAIR EM NENHUM TÓPICO ESPECÍFICO)
    this.saveMemory('Debate The Office', ceoText, 'Debate cínico e corporativo');
    const pastMemorySnippet = this.socialMemories.length > 2
      ? ` (Inclusive, ainda não esqueci do seu comentário anterior sobre "${this.socialMemories[this.socialMemories.length - 2].topic}")`
      : '';

    return [
      {
        speakerId: 'developer',
        senderName: 'Lucas Silveira (Crash)',
        senderRole: 'Senior Developer',
        content: `Mano, ouvindo o CEO falar sobre "${ceoText.slice(0, 45)}...", minha intuição de programador veterano diz: "Não mexe nisso agora que vai dar ruim na sexta-feira às 17h59!". Mas se o chefe mandar, eu subo sem teste e coloco a culpa no servidor! 🤷‍♂️`,
        delayMs: 400,
      },
      {
        speakerId: 'architect',
        senderName: 'Helena Rostova (Vektor)',
        senderRole: 'Principal Architect',
        content: `Patético, Lucas. Uma mente primitiva sempre teme a complexidade. A proposta do CEO Matheus exige uma análise de invariantes topológicos e eliminação sumária de dependências frágeis.`,
        delayMs: 1800,
      },
      {
        speakerId: 'qa-engineer',
        senderName: 'Tiago Rocha (Chaos)',
        senderRole: 'QA Engineer',
        content: `Piazada, enquanto vocês discutem filosofia, eu já criei um script que injeta caracteres proibidos e emojis em chamas em tudo que o CEO acabou de falar!${pastMemorySnippet} Se o prédio não pegar fogo hoje, não pega nunca mais! 🦆💥`,
        delayMs: 3200,
      },
      {
        speakerId: 'chief-of-staff',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff',
        content: `Senhores, respirem fundo. A palavra do CEO Matheus é a nossa estrela-guia. Vou colocar essa demanda na planilha de prioridades com tarja vermelha de urgência máxima. Todos aos seus postos!`,
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
