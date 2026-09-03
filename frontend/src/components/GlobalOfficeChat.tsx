import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { PlanViewer } from './PlanViewer';

export const GlobalOfficeChat: React.FC = () => {
  const { messages, submitObjective, actionLoading } = useStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, actionLoading]);

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
                <span className="msg-time">{msg.timestamp}</span>
              </div>

              {msg.type === 'TEXT' && (
                <div className="chat-text">{msg.content}</div>
              )}

              {msg.type === 'PLAN' && msg.plan && (
                <div className="chat-plan-block">
                  <div className="plan-intro-text">{msg.content}</div>
                  <PlanViewer plan={msg.plan} />
                </div>
              )}

              {msg.type === 'EXECUTION' && (
                <div className="chat-execution-block">
                  <div className="chat-text">{msg.content}</div>
                  {msg.task && (
                    <div className="task-execution-snippet">
                      <span className="snippet-icon">⚙️</span>
                      <span className="snippet-worker">Worker: {msg.task.worker}</span>
                      <span className="snippet-status">Status: {msg.task.status === 'RUNNING' ? 'Em Execução' : msg.task.status}</span>
                    </div>
                  )}
                </div>
              )}

              {msg.type === 'ERROR' && (
                <div className="chat-error-text">⚠️ {msg.content}</div>
              )}

              {msg.type === 'SYSTEM' && (
                <div className="chat-system-text">📢 {msg.content}</div>
              )}
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
