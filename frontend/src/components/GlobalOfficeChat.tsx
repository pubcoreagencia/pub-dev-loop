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
  const [respondingAgent, setRespondingAgent] = useState<{ id: string; name: string; role: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, actionLoading, pendingApprovals, activeTab, respondingAgent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || actionLoading || Boolean(respondingAgent)) return;
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

      // Executa chamada real exibindo o nome de cada funcionário respondendo
      const agentKeys = selectedAgent && selectedAgent.id !== 'ceo'
        ? [selectedAgent.id]
        : ['developer', 'architect', 'reviewer', 'qa-engineer', 'chief-of-staff'];

      for (let i = 0; i < agentKeys.length; i++) {
        const agentId = agentKeys[i];
        const profile = OFFICE_AGENTS_AI_PROFILES[agentId];
        if (!profile) continue;

        // Atualiza para o nome exato do funcionário que está respondendo
        setRespondingAgent({ id: agentId, name: profile.name, role: profile.role });

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
          console.error(`AI response error for ${agentId}:`, err);
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
      setRespondingAgent(null);
    }
  };

  const handleTriggerWatercoolerDialogue = () => {
    const dialogue = defaultWatercoolerEngine.getNextDialogue();
    dialogue.forEach((d: any, idx: number) => {
      setTimeout(() => {
        const senderProfile = OFFICE_AGENTS_AI_PROFILES[d.speakerId] || {
          name: d.speakerName,
          role: 'Especialista',
        };

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
      {/* CABEÇALHO COM ABAS E STATUS DO GATEWAY */}
      <div className="chat-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('COMMAND')}
            style={{
              background: activeTab === 'COMMAND' ? '#1e293b' : 'transparent',
              border: activeTab === 'COMMAND' ? '1px solid #38bdf8' : '1px solid transparent',
              color: activeTab === 'COMMAND' ? '#38bdf8' : '#94a3b8',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
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
              background: activeTab === 'WATERCOOLER' ? '#291e17' : 'transparent',
              border: activeTab === 'WATERCOOLER' ? '1px solid #f59e0b' : '1px solid transparent',
              color: activeTab === 'WATERCOOLER' ? '#f59e0b' : '#94a3b8',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>☕</span> WATERCOOLER
          </button>
        </div>

        {/* STATUS DISCRETO DO GATEWAY AUTOMÁTICO */}
        <div className="chat-status-pill" title="Gateways 100% Free: OpenRouter Free (Llama 3.3 70B / Gemini 2.0 Flash) ➔ 9Router Free">
          <span>●</span> 100% FREE (LLAMA 3.3 / GEMINI ➔ 9ROUTER)
        </div>
      </div>

      {/* ÁREA DE MENSAGENS COM CSS CLASSES OFICIAIS */}
      <div className="chat-messages-area">
        {activeTab === 'WATERCOOLER' && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 14px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#f59e0b',
            }}
          >
            <span>💬 Canal Livre de Convivência &amp; Humor Negro</span>
            <button
              onClick={handleTriggerWatercoolerDialogue}
              style={{
                background: '#291e17',
                border: '1px solid #f59e0b',
                color: '#fef3c7',
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Fofoca do Café ☕
            </button>
          </div>
        )}

        {messages.map((msg) => {
          const senderClass = msg.sender.toLowerCase().replace(/_/g, '-');
          const isCeo = senderClass === 'ceo';
          const isChief = senderClass === 'chief-of-staff' || senderClass === 'chief_of_staff';
          const rowClass = isCeo ? 'ceo' : isChief ? 'chief_of_staff' : senderClass === 'system' ? 'system' : 'agent';

          return (
            <div key={msg.id} className={`chat-bubble-row ${rowClass}`}>
              <div className="chat-bubble-wrapper">
                <div className="chat-sender-header">
                  <span className="sender-tag">{msg.senderName || msg.sender}</span>
                  {msg.senderRole && <span className="sender-role">{msg.senderRole}</span>}
                  <span className="msg-time">{msg.timestamp || ''}</span>
                </div>
                <div className="chat-text">{msg.content}</div>
                {msg.plan && <PlanViewer plan={msg.plan} />}
              </div>
            </div>
          );
        })}

        {respondingAgent && (
          <div className="chat-bubble-row agent">
            <div className="chat-bubble-wrapper thinking-bubble">
              <div className="chat-sender-header" style={{ marginBottom: '4px' }}>
                <span className="sender-tag" style={{ color: '#38bdf8' }}>{respondingAgent.name}</span>
                <span className="sender-role">{respondingAgent.role}</span>
              </div>
              <div className="thinking-dots">
                💬 {respondingAgent.name} está respondendo...
              </div>
            </div>
          </div>
        )}

        {actionLoading && (
          <div className="chat-bubble-row system">
            <div className="chat-bubble-wrapper thinking-bubble">
              <div className="thinking-dots">
                ⚙️ Chief of Staff formulando plano estratégico...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ÁREA DE INPUT INTEGRADA AO DESIGN DO ESCRITÓRIO */}
      <form onSubmit={handleSubmit} className="chat-input-bar">
        <span className="input-prompt-label">&gt;</span>
        <input
          type="text"
          className="chat-text-input"
          placeholder={
            activeTab === 'COMMAND'
              ? 'Defina a diretriz para a equipe autônoma...'
              : 'Fale com a equipe do escritório (humor negro, dúvidas, zoeiras)...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={actionLoading || Boolean(respondingAgent)}
        />
        <button
          type="submit"
          className="btn-dispatch-objective"
          disabled={actionLoading || Boolean(respondingAgent) || !inputText.trim()}
          style={{
            background: activeTab === 'COMMAND'
              ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
              : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
          }}
        >
          {actionLoading || Boolean(respondingAgent) ? '...' : activeTab === 'COMMAND' ? 'DESPACHAR' : 'FALAR'}
        </button>
      </form>
    </div>
  );
};
