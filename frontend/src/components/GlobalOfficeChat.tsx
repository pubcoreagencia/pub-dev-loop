import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { PlanViewer } from './PlanViewer';
import { defaultWatercoolerEngine } from '../services/watercoolerEngine';

export const GlobalOfficeChat: React.FC = () => {
  const {
    messages,
    addMessage,
    submitObjective,
    actionLoading,
    pendingApprovals,
    decideCeoApproval,
    triggerSpeechBubble,
    selectedAgent,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'COMMAND' | 'WATERCOOLER'>('COMMAND');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, actionLoading, pendingApprovals, activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || actionLoading) return;
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

      // Dispara thread multi-agente autêntica com respostas em cascata
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
      {/* CABEÇALHO COM ABAS DE NAVEGAÇÃO */}
      <div className="chat-header">
        <div style={{ display: 'flex', gap: '8px' }}>
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
            <span>☕</span> CORREDOR &amp; WATERCOOLER
          </button>
        </div>

        {activeTab === 'WATERCOOLER' ? (
          <button
            onClick={handleTriggerWatercoolerDialogue}
            style={{
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            🎲 Puxar Conversa no Café
          </button>
        ) : (
          <div className="chat-status-pill">
            LINHA DIRETA • CHIEF OF STAFF
          </div>
        )}
      </div>

      {/* ÁREA DE HISTÓRICO DE MENSAGENS */}
      <div className="chat-messages-area">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble-row ${msg.sender.toLowerCase()}`}
          >
            <div className="chat-bubble-wrapper">
              <div className="chat-sender-header">
                <span className="sender-tag">{msg.senderName}</span>
                {msg.senderRole && (
                  <span className="sender-role">({msg.senderRole})</span>
                )}
                <span className="msg-timestamp">{msg.timestamp}</span>
              </div>

              <div className="chat-bubble-content">{msg.content}</div>

              {msg.plan && (
                <div className="plan-attachment-container">
                  <PlanViewer plan={msg.plan} />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* CARDS DE APROVAÇÃO PENDENTE DO CEO */}
        {pendingApprovals.map((appr) => (
          <div className="chat-bubble-row approval-request-row" key={appr.id}>
            <div className="approval-card-box">
              <div className="approval-card-header">
                <span className="approval-badge">👑 DECISÃO ESTRATÉGICA DO CEO</span>
                <span className="approval-type-tag">{appr.type}</span>
              </div>
              <h4 className="approval-title">{appr.title}</h4>
              <p className="approval-rationale">{appr.rationale}</p>
              <div className="approval-actions-row">
                <button
                  type="button"
                  className="btn-approve-action"
                  onClick={() => decideCeoApproval(appr.id, 'GRANT', 'Aprovado pelo CEO')}
                >
                  ✓ APROVAR DIRETRIZ
                </button>
                <button
                  type="button"
                  className="btn-reject-action"
                  onClick={() => decideCeoApproval(appr.id, 'REJECT', 'Rejeitado pelo CEO')}
                >
                  ✕ REJEITAR
                </button>
              </div>
            </div>
          </div>
        ))}

        {actionLoading && (
          <div className="chat-bubble-row chief_of_staff">
            <div className="chat-bubble-wrapper thinking-bubble">
              <span className="thinking-dots">🧠 Dr. Arthur Vance formulando plano e alocando especialistas...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* BARRA DE ENTRADA DO CEO */}
      <form onSubmit={handleSubmit} className="chat-input-bar">
        <span className="input-prompt-label">CEO &gt;</span>
        <input
          type="text"
          className="chat-text-input"
          placeholder={
            activeTab === 'COMMAND'
              ? 'Envie um objetivo estratégico para o escritório (ex: Implementar tela de checkout)...'
              : selectedAgent
              ? `Fale diretamente com ${selectedAgent.name} (ou faça uma piada de café)...`
              : 'Converse livremente com a equipe no corredor (ou selecione um agente na mesa)...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={actionLoading}
        />
        <button
          type="submit"
          className={activeTab === 'COMMAND' ? 'btn-dispatch-objective' : 'btn-watercooler-send'}
          style={
            activeTab === 'WATERCOOLER'
              ? {
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0 16px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }
              : undefined
          }
          disabled={actionLoading || !inputText.trim()}
        >
          {actionLoading
            ? 'PLANEJANDO...'
            : activeTab === 'COMMAND'
            ? 'DESPACHAR OBJETIVO'
            : 'FALAR COM TIME'}
        </button>
      </form>
    </div>
  );
};
