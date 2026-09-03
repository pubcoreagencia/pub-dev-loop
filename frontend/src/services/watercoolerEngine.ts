export interface WatercoolerDialogue {
  speakerId: 'chief-of-staff' | 'architect' | 'developer' | 'reviewer' | 'qa-engineer';
  content: string;
  topic?: 'COFFEE' | 'MUSIC' | 'RIVALRY' | 'TECH_DEBATE' | 'CELEBRATION' | 'WEEKEND';
}

const WATERCOOLER_CONVERSATIONS: WatercoolerDialogue[][] = [
  // 1. O Café e o Linter
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

  // 2. A Briga Arquitetura vs Gambiarra
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

  // 3. O Toca-Discos e a Música no Escritório
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

  // 4. Testes do Tiago e o Caos
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

export class WatercoolerEngine {
  private lastDialogueIndex = 0;

  /**
   * Generates next spontaneous organic dialogue snippet.
   */
  public getNextDialogue(): WatercoolerDialogue[] {
    const dialogue = WATERCOOLER_CONVERSATIONS[this.lastDialogueIndex % WATERCOOLER_CONVERSATIONS.length];
    this.lastDialogueIndex++;
    return dialogue;
  }

  /**
   * Generates an authentic personality response to direct CEO remarks in chat.
   */
  public respondToCeo(
    ceoText: string,
    targetAgentId?: string
  ): { speakerId: string; senderName: string; senderRole: string; content: string } {
    const textLower = ceoText.toLowerCase();

    // Se o CEO mencionou alguém especificamente ou foi selecionado
    if (targetAgentId === 'chief-of-staff' || textLower.includes('arthur') || textLower.includes('chief')) {
      return {
        speakerId: 'chief-of-staff',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff',
        content: textLower.includes('café')
          ? 'Comandante, o café especial está fresco na sala de reuniões. Estamos totalmente alinhados com suas diretrizes.'
          : textLower.includes('plano') || textLower.includes('meta')
          ? 'Perfeito, CEO. Estruturando o plano estratégico e distribuindo as etapas com governança e checkpoints claros.'
          : `Entendido, CEO. "Alinhamento e governança evitam retrabalho". Estou monitorando a esteira de execução de perto.`,
      };
    }

    if (targetAgentId === 'architect' || textLower.includes('helena') || textLower.includes('arquiteta')) {
      return {
        speakerId: 'architect',
        senderName: 'Helena Rostova',
        senderRole: 'Principal Architect',
        content: textLower.includes('refatorar') || textLower.includes('design') || textLower.includes('arquitetura')
          ? 'Excelente direcionamento, CEO. Uma arquitetura limpa e desacoplada é a única garantia de longevidade para o sistema.'
          : textLower.includes('rápido') || textLower.includes('pressa')
          ? 'Podemos acelerar, desde que não violemos os princípios SOLID. Como sempre digo: "Se a abstração estiver errada, todo o resto é ilusão".'
          : 'Sob seu comando, Matheus. Garantindo que todo o grafo de componentes respeite os padrões canônicos.',
      };
    }

    if (targetAgentId === 'developer' || textLower.includes('lucas') || textLower.includes('dev') || textLower.includes('código')) {
      return {
        speakerId: 'developer',
        senderName: 'Lucas Silveira',
        senderRole: 'Senior Developer',
        content: textLower.includes('bug') || textLower.includes('erro')
          ? 'Opa, peguei aqui! Abrindo o terminal agora, já mando o hotfix compilado em 3 minutos. Não me para que eu tô no flow!'
          : textLower.includes('sexta') || textLower.includes('deploy')
          ? 'Bora subir pra produção! Testei na minha máquina e o build passou de primeira. Menos burocracia, mais código no ar! 🚀'
          : 'Pode deixar comigo, Comandante! Já estou codando a todo vapor com 140 BPM no fone.',
      };
    }

    if (targetAgentId === 'reviewer' || textLower.includes('beatriz') || textLower.includes('review') || textLower.includes('segurança')) {
      return {
        speakerId: 'reviewer',
        senderName: 'Beatriz Mendes',
        senderRole: 'Code Reviewer',
        content: textLower.includes('aprova') || textLower.includes('passa')
          ? 'Vou auditar cada linha minuciosamente. Se não houver brechas de segurança nem memory leaks, o selo verde está garantido.'
          : 'Comandante, mantendo a guarda alta. O Lucas já tentou passar dois anys despercebidos, mas a Sentinel não dorme em serviço.',
      };
    }

    if (targetAgentId === 'qa-engineer' || textLower.includes('tiago') || textLower.includes('teste') || textLower.includes('qa')) {
      return {
        speakerId: 'qa-engineer',
        senderName: 'Tiago Rocha',
        senderRole: 'QA Engineer',
        content: textLower.includes('quebra') || textLower.includes('crash')
          ? 'Minha especialidade! Já estou soltando o Chaos Monkey e preparando a bateria de testes de estresse. Os patinhos de borracha aprovam! 🦆'
          : 'Pode contar comigo, CEO. Se houver qualquer falha de borda ou condição de corrida, eu acho antes do usuário.',
      };
    }

    // Default: Chief of Staff responde em nome do escritório
    return {
      speakerId: 'chief-of-staff',
      senderName: 'Dr. Arthur Vance',
      senderRole: 'Chief of Staff',
      content: `Mensagem recebida, Comandante. Todos os 5 especialistas (Helena, Lucas, Beatriz, Tiago e eu) estão a postos e operacionais.`,
    };
  }
}

export const defaultWatercoolerEngine = new WatercoolerEngine();
