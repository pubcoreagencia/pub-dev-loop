import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { PlanViewer } from './PlanViewer';
import { defaultWatercoolerEngine } from '../services/watercoolerEngine';
import { defaultAiChatService, OFFICE_AGENTS_AI_PROFILES } from '../services/aiChatService';

export const GlobalOfficeChat: React.FC = () => {
  const {
    messages,
    addMessage,
    submitObjective,
    actionLoading,
    pendingApprovals,
    triggerSpeechBubble,
    selectedAgent,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'COMMAND' | 'WATERCOOLER'>('COMMAND');
  const [inputText, setInputText] = useState('');
  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState(defaultAiChatService.getApiKey());
  const [selectedModel, setSelectedModel] = useState(defaultAiChatService.getModel());
  const [isAiResponding, setIsAiResponding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, actionLoading, pendingApprovals, activeTab, isAiResponding]);

  const handleSaveAiConfig = (e: React.FormEvent) => {
    e.preventDefault();
    defaultAiChatService.setApiKey(aiKeyInput);
    defaultAiChatService.setModel(selectedModel);
    setIsAiConfigOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || actionLoading || isAiResponding) return;
    const text = inputText.trim();
    setInputText('');

    if (activeTab === 'COMMAND') {
      // Despacho de Objetivo Estratégico do CEO
      await submitObjective(text);
    } else {
      // Conversa Livre do Watercooler / Relação com os Funcionários
      addMessage({
        sender: 'CEO',
        senderName: 'Matheus Paes (CEO)',
        senderRole: 'Comandante',
        content: text,
        type: 'TEXT',
      });

      // SE GROK / OPENROUTER ESTIVER CONFIGURADO, USA LLM REAL!
      if (defaultAiChatService.isConfigured()) {
        setIsAiResponding(true);
        const agentKeys = selectedAgent && selectedAgent.id !== 'ceo'
          ? [selectedAgent.id]
          : ['developer', 'architect', 'reviewer', 'qa-engineer', 'chief-of-staff'];

        for (let i = 0; i < agentKeys.length; i++) {
          const agentId = agentKeys[i];
          const profile = OFFICE_AGENTS_AI_PROFILES[agentId];
          if (!profile) continue;

          try {
            const aiContent = await defaultAiChatService.callLlmForAgent(agentId, text);
            addMessage({
              sender: agentId.toUpperCase().replace(/-/g, '_') as any,
              senderName: profile.name,
              senderRole: profile.role,
              content: aiContent,
              type: 'TEXT',
            });
            triggerSpeechBubble({
              senderId: agentId,
              senderName: profile.name,
              content: aiContent.slice(0, 60) + (aiContent.length > 60 ? '...' : ''),
              durationMs: 7000,
              type: 'TASK',
            });
          } catch (err: any) {
            console.error(`AI error for ${agentId}:`, err);
            // Fallback para o motor consciente
            const fallbackReplies = defaultWatercoolerEngine.generateMultiAgentReaction(text, agentId);
            if (fallbackReplies[0]) {
              addMessage({
                sender: agentId.toUpperCase().replace(/-/g, '_') as any,
                senderName: profile.name,
                senderRole: profile.role,
                content: fallbackReplies[0].content,
                type: 'TEXT',
              });
            }
          }
        }
        setIsAiResponding(false);
      } else {
        // Dispara thread multi-agente consciente com respostas em cascata
        const replies = defaultWatercoolerEngine.generateMultiAgentReaction(text, selectedAgent?.id);
        replies.forEach((reply) => {
          setTimeout(() => {
            addMessage({
              sender: reply.speakerId.toUpperCase().replace(/-/g, '_') as any,
              senderName: reply.senderName,
              senderRole: reply.senderRole,
              content: reply.content,
              type: 'TEXT',
            });

            triggerSpeechBubble({
              senderId: reply.speakerId,
              senderName: reply.senderName,
              content: reply.content.slice(0, 55) + (reply.content.length > 55 ? '...' : ''),
              durationMs: 7000,
              type: 'TASK',
            });
          }, reply.delayMs || 600);
        });
      }
    }
  };

  const handleTriggerWatercoolerDialogue = () => {
    const dialogues = defaultWatercoolerEngine.getNextDialogue();
    dialogues.forEach((d, idx) => {
      setTimeout(() => {
        const senderProfile = d.speakerId === 'chief-of-staff' ? { name: 'Dr. Arthur Vance', role: 'Chief of Staff' }
          : d.speakerId === 'architect' ? { name: 'Helena Rostova', role: 'Principal Architect' }
          : d.speakerId === 'developer' ? { name: 'Lucas Silveira', role: 'Senior Developer' }
          : d.speakerId === 'reviewer' ? { name: 'Beatriz Mendes', role: 'Code Reviewer' }
          : { name: 'Tiago Rocha', role: 'QA Engineer' };

        addMessage({
          sender: d.speakerId.toUpperCase().replace(/-/g, '_') as any,
          senderName: senderProfile.name,
          senderRole: senderProfile.role,
          content: d.content,
          type: 'TEXT',
        });

        triggerSpeechBubble({
          senderId: d.speakerId,
          senderName: senderProfile.name,
          content: d.content.slice(0, 45) + (d.content.length > 45 ? '...' : ''),
          durationMs: 5000,
          type: 'TASK',
        });
      }, idx * 1200);
    });
  };

  return (
    <div className="office-chat-container">
      {/* CABEÇALHO COM ABAS E BOTÃO GROK AI */}
      <div className="chat-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('COMMAND')}
            style={{
              background: activeTab === 'COMMAND' ? '#1e293b' : 'transparent',
              border: activeTab === 'COMMAND' ? '1px solid #38bdf8' : '1px solid transparent',
              color: activeTab === 'COMMAND' ? '#38bdf8' : '#94a3b8',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📟</span> COMANDO DO CEO
          </button>
          <button
            onClick={() => setActiveTab('WATERCOOLER')}
            style={{
              background: activeTab === 'WATERCOOLER' ? '#1e293b' : 'transparent',
              border: activeTab === 'WATERCOOLER' ? '1px solid #f59e0b' : '1px solid transparent',
              color: activeTab === 'WATERCOOLER' ? '#f59e0b' : '#94a3b8',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>☕</span> WATERCOOLER
          </button>
        </div>

        {/* BOTÃO DE CONFIGURAÇÃO DE GROK / IA */}
        <button
          onClick={() => setIsAiConfigOpen(!isAiConfigOpen)}
          title="Configurar Provedor de IA (Grok / OpenRouter)"
          style={{
            background: defaultAiChatService.isConfigured() ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            border: `1px solid ${defaultAiChatService.isConfigured() ? '#22c55e' : '#f59e0b'}`,
            borderRadius: '6px',
            padding: '3px 8px',
            color: defaultAiChatService.isConfigured() ? '#22c55e' : '#f59e0b',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>⚡</span> {defaultAiChatService.isConfigured() ? 'Grok AI Ativo' : 'Conectar Grok'}
        </button>
      </div>

      {/* MODAL / POPOVER DE CONFIGURAÇÃO DO GROK / OPENROUTER */}
      {isAiConfigOpen && (
        <div
          style={{
            background: '#090d16',
            border: '1.5px solid #38bdf8',
            borderRadius: '8px',
            padding: '12px',
            margin: '8px 12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
              🤖 Provedor de Conversação IA (Grok / xAI / OpenRouter)
            </span>
            <button
              onClick={() => setIsAiConfigOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSaveAiConfig} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#94a3b8' }}>Chave API (OpenRouter ou xAI):</label>
              <input
                type="password"
                placeholder="sk-or-v1-... ou sua chave de IA"
                value={aiKeyInput}
                onChange={(e) => setAiKeyInput(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#f8fafc',
                  padding: '5px 8px',
                  fontSize: '11px',
                  marginTop: '2px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#94a3b8' }}>Modelo de Conversação:</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#f8fafc',
                  padding: '5px 8px',
                  fontSize: '11px',
                  marginTop: '2px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="x-ai/grok-2-1212">x-ai/grok-2-1212 (Grok Oficial)</option>
                <option value="x-ai/grok-beta">x-ai/grok-beta</option>
                <option value="google/gemini-2.0-flash-exp:free">Google Gemini 2.0 Flash (Free)</option>
                <option value="meta-llama/llama-3.3-70b-instruct:free">Meta Llama 3.3 70B (Free)</option>
                <option value="mistralai/mistral-small-24b-instruct-2501:free">Mistral Small 24B (Free)</option>
              </select>
            </div>
            <button
              type="submit"
              style={{
                background: '#0284c7',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                padding: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              Salvar Configuração de IA
            </button>
          </form>
        </div>
      )}

      {/* ÁREA DE MENSAGENS */}
      <div className="chat-messages">
        {activeTab === 'WATERCOOLER' && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 12px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
              fontSize: '11px',
              color: '#f59e0b',
            }}
          >
            <span>💬 Conversa de Corredor &amp; Humor Negro</span>
            <button
              onClick={handleTriggerWatercoolerDialogue}
              style={{
                background: 'transparent',
                border: '1px solid #f59e0b',
                color: '#f59e0b',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Fofoca no Café ☕
            </button>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message-item ${msg.sender.toLowerCase()}`}>
            <div className="message-header">
              <span className="sender-name">{msg.senderName || msg.sender}</span>
              {msg.senderRole && <span className="sender-role">{msg.senderRole}</span>}
              <span className="message-time">{msg.timestamp}</span>
            </div>
            <div className="message-body">{msg.content}</div>

            {msg.plan && <PlanViewer plan={msg.plan} />}
          </div>
        ))}

        {isAiResponding && (
          <div style={{ padding: '8px 12px', fontSize: '11px', color: '#38bdf8', fontStyle: 'italic' }}>
            ⚡ Os especialistas do escritório estão pensando com IA...
          </div>
        )}

        {actionLoading && (
          <div className="chat-message-item system loading">
            <div className="message-body">
              <span>⚡ O Chief of Staff e os Especialistas estão deliberando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ÁREA DE SUBMISSÃO / INPUT */}
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          placeholder={
            activeTab === 'COMMAND'
              ? 'Defina a diretriz para a equipe autônoma...'
              : 'Fale qualquer coisa com o escritório (humor negro, perguntas, piadas)...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={actionLoading || isAiResponding}
        />
        <button
          type="submit"
          disabled={actionLoading || isAiResponding || !inputText.trim()}
          style={{
            background: activeTab === 'COMMAND' ? '#0284c7' : '#d97706',
          }}
        >
          {actionLoading || isAiResponding ? '...' : activeTab === 'COMMAND' ? 'DESPACHAR' : 'FALAR'}
        </button>
      </form>
    </div>
  );
};
