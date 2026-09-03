import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { PlanViewer } from './PlanViewer';

export const GlobalOfficeChat: React.FC = () => {
  const { messages, submitObjective, actionLoading, pendingApprovals, decideCeoApproval } = useStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, actionLoading, pendingApprovals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || actionLoading) return;
    const objective = inputText.trim();
    setInputText('');
    await submitObjective(objective);
  };

  return (
    <div className="office-chat-container">
      {/* CABEÇALHO DO CHAT */}
      <div className="chat-header">
        <div className="chat-title-group">
          <span className="terminal-prompt-icon">📟</span>
          <span className="chat-title">CHAT GLOBAL DO ESCRITÓRIO • SUPERFÍCIE DE COMANDO DO CEO</span>
        </div>
        <div className="chat-status-pill">
          LINHA DIRETA • CHIEF OF STAFF
        </div>
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
              <span className="thinking-dots">🧠 Chief of Staff formulando plano e alocando especialistas...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* BARRA DE ENTRADA DO CEO (FIXA NO RODAPÉ DO CHAT) */}
      <form onSubmit={handleSubmit} className="chat-input-bar">
        <span className="input-prompt-label">CEO &gt;</span>
        <input
          type="text"
          className="chat-text-input"
          placeholder="Envie um objetivo estratégico para o escritório (ex: Implementar tela de checkout)..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={actionLoading}
        />
        <button
          type="submit"
          className="btn-dispatch-objective"
          disabled={actionLoading || !inputText.trim()}
        >
          {actionLoading ? 'PLANEJANDO...' : 'DESPACHAR AO ESCRITÓRIO'}
        </button>
      </form>
    </div>
  );
};
