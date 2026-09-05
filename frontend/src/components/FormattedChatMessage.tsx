import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface FormattedChatMessageProps {
  content: string;
  isChief?: boolean;
}

const CollapsibleCodeBlock: React.FC<{ content: string; lang?: string }> = ({ content, lang }) => {
  const [isExpanded, setIsExpanded] = useState(false); // minimizado por padrão conforme ordem do CEO Matheus Paes!
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = content.split('\n');
  const lineCount = lines.length;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div
        className="chat-code-card"
        style={{
          margin: '8px 0',
          borderRadius: '8px',
          border: '1px solid #334155',
          background: '#0a0e1a',
          overflow: 'hidden',
          fontSize: '11px',
        }}
      >
        {/* Header do Bloco com Controles: Minimizado por Padrão */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            background: 'rgba(30, 41, 59, 0.85)',
            borderBottom: isExpanded ? '1px solid #334155' : 'none',
            fontSize: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              💻 {lang || 'código'}
            </span>
            <span style={{ color: '#64748b' }}>•</span>
            <span style={{ color: '#94a3b8' }}>{lineCount} {lineCount === 1 ? 'linha' : 'linhas'}</span>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                borderRadius: '4px',
                padding: '2px 7px',
                fontSize: '9px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isExpanded ? '▲ Recolher' : '▼ Expandir'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setIsMaximized(true)}
              title="Maximizar Código em Tela Cheia"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #475569',
                color: '#cbd5e1',
                borderRadius: '4px',
                padding: '2px 7px',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>⛶</span>
              <span>Maximizar</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${copied ? '#22c55e' : '#475569'}`,
                color: copied ? '#4ade80' : '#cbd5e1',
                borderRadius: '4px',
                padding: '2px 7px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Conteúdo: Se recolhido, linha resumida compacta; se expandido, código completo */}
        {isExpanded ? (
          <pre
            style={{
              margin: 0,
              padding: '10px 12px',
              maxHeight: '300px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#f1f5f9',
              lineHeight: '1.5',
            }}
          >
            <code>{content}</code>
          </pre>
        ) : (
          <div
            onClick={() => setIsExpanded(true)}
            title="Clique para expandir código"
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              background: 'rgba(15, 23, 42, 0.4)',
              color: '#64748b',
              fontFamily: 'monospace',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
              {lines[0] || '// Bloco de código minimizado'}
            </code>
            <span style={{ fontSize: '9px', color: '#38bdf8', flexShrink: 0, marginLeft: '8px' }}>
              (Clique para abrir)
            </span>
          </div>
        )}
      </div>

      {/* Modal Tela Cheia (Maximizar) */}
      {isMaximized &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(2, 6, 23, 0.85)',
              backdropFilter: 'blur(12px)',
              zIndex: 99999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
            onClick={() => setIsMaximized(false)}
          >
            <div
              style={{
                width: '900px',
                maxWidth: '96vw',
                height: '85vh',
                background: '#090d16',
                border: '1px solid #334155',
                borderRadius: '16px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(56, 189, 248, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal Maximizado */}
              <div
                style={{
                  padding: '12px 20px',
                  background: 'linear-gradient(90deg, #1e293b, #0f172a)',
                  borderBottom: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>💻</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                      Visualizador de Código • {lang || 'TEXT'}
                    </h3>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                      {lineCount} linhas • Modo Tela Cheia
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(56, 189, 248, 0.1)',
                      border: `1px solid ${copied ? '#22c55e' : '#38bdf8'}`,
                      color: copied ? '#4ade80' : '#38bdf8',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? '✓ Copiado!' : '📋 Copiar Tudo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMaximized(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid #475569',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Fechar
                  </button>
                </div>
              </div>

              {/* Editor / Pre com números de linha */}
              <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex' }}>
                <div
                  style={{
                    userSelect: 'none',
                    textAlign: 'right',
                    paddingRight: '16px',
                    marginRight: '12px',
                    borderRight: '1px solid #1e293b',
                    color: '#475569',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.6',
                  }}
                >
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: '#e2e8f0',
                    flex: 1,
                  }}
                >
                  <code>{content}</code>
                </pre>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

const renderInline = (text: string): React.ReactNode => {
  // Regex to split by inline code `...`, bold **...**, and links [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={idx} className="chat-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="chat-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        return (
          <a
            key={idx}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="chat-link"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }

    return <span key={idx}>{part}</span>;
  });
};

interface Block {
  type: 'code' | 'heading' | 'bullet' | 'paragraph';
  content: string;
  lang?: string;
  level?: number;
}

function parseContentToBlocks(rawText: string): Block[] {
  const blocks: Block[] = [];
  if (!rawText) return blocks;

  // Split by fenced code blocks ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_\-\.]*)\r?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    const textBefore = rawText.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      parseTextBlocks(textBefore, blocks);
    }

    blocks.push({
      type: 'code',
      lang: match[1] || 'bash',
      content: match[2].trimEnd(),
    });

    lastIndex = match.index + match[0].length;
  }

  const remainingText = rawText.slice(lastIndex);
  if (remainingText.trim()) {
    parseTextBlocks(remainingText, blocks);
  }

  return blocks;
}

function parseTextBlocks(text: string, blocks: Block[]) {
  const lines = text.split(/\r?\n/);
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join(' ').trim();
      if (pText) {
        blocks.push({ type: 'paragraph', content: pText });
      }
      currentParagraphLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // Check headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      continue;
    }

    // Check bullets
    const bulletMatch = trimmed.match(/^([-*•]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({
        type: 'bullet',
        content: bulletMatch[2].trim(),
      });
      continue;
    }

    // Check horizontal rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      flushParagraph();
      continue;
    }

    currentParagraphLines.push(trimmed);
  }

  flushParagraph();
}

export const FormattedChatMessage: React.FC<FormattedChatMessageProps> = ({
  content,
  isChief,
}) => {
  const blocks = parseContentToBlocks(content);

  return (
    <div className={`formatted-chat-content ${isChief ? 'chief-content-layout' : ''}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return <CollapsibleCodeBlock key={idx} content={block.content} lang={block.lang} />;
        }

        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5';
          return (
            <Tag key={idx} className={`chat-heading chat-heading-${block.level}`}>
              {renderInline(block.content)}
            </Tag>
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={idx} className="chat-bullet-row">
              <span className="bullet-marker">▹</span>
              <div className="bullet-body">{renderInline(block.content)}</div>
            </div>
          );
        }

        return (
          <p key={idx} className="chat-paragraph">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
};
