import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { PlanViewer } from './PlanViewer';

export const GlobalOfficeChat: React.FC = () => {
  const { messages, submitObjective, actionLoading } = useStore();
  const [inputObjective, setInputObjective] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputObjective.trim() || actionLoading) return;
    const obj = inputObjective;
    setInputObjective('');
    await submitObjective(obj);
  };

  return (
    <div className="office-chat-container">
      <div className="chat-header">
        <div className="chat-title-group">
          <span className="terminal-prompt-icon">📟</span>
          <h2 className="chat-title">GLOBAL OFFICE CHAT • CEO COMMAND SURFACE</h2>
        </div>
        <span className="chat-status-pill">DIRECT LINE • CHIEF OF STAFF</span>
      </div>

      <div className="chat-messages-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble-row ${msg.sender.toLowerCase()}`}>
            <div className="chat-bubble-wrapper">
              <div className="chat-sender-header">
                <span className="sender-tag">{msg.senderName}</span>
                {msg.senderRole && <span className="sender-role">({msg.senderRole})</span>}
                <span className="msg-time">{msg.timestamp}</span>
              </div>

              <div className="chat-content-body">
                <p className="chat-text">{msg.content}</p>
                {msg.type === 'PLAN' && msg.plan && (
                  <PlanViewer plan={msg.plan} />
                )}
                {msg.type === 'EXECUTION' && msg.task && (
                  <div className="task-execution-snippet">
                    <span className="snippet-badge">TASK #{msg.task.id.slice(0, 18)}</span>
                    <span className="snippet-agent">Agent: <strong>{msg.task.agentId || 'unassigned'}</strong></span>
                    <span className="snippet-worker">Worker: <code>{msg.task.worker}</code></span>
                    <span className={`snippet-status ${msg.task.status.toLowerCase()}`}>{msg.task.status}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {actionLoading && (
          <div className="chat-bubble-row chief_of_staff thinking">
            <div className="chat-bubble-wrapper">
              <div className="chat-sender-header">
                <span className="sender-tag">Chief of Staff</span>
                <span className="sender-role">(Analyzing & Formulating Plan...)</span>
              </div>
              <p className="chat-text blink">Decomposing objective into specialist plan steps...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <div className="input-prompt-label">CEO &gt;</div>
        <input
          type="text"
          className="chat-text-input"
          placeholder="Give the office an objective... (e.g. Implement checkout feature for PUB ECOM)"
          value={inputObjective}
          onChange={(e) => setInputObjective(e.target.value)}
          disabled={actionLoading}
        />
        <button
          type="submit"
          className="btn-dispatch-objective"
          disabled={!inputObjective.trim() || actionLoading}
        >
          {actionLoading ? 'ORCHESTRATING...' : 'DISPATCH TO OFFICE ⏎'}
        </button>
      </form>
    </div>
  );
};
