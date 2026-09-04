import React, { useState } from 'react';

interface FormattedChatMessageProps {
  content: string;
  isChief?: boolean;
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button type="button" onClick={handleCopy} className="chat-copy-btn">
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
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
          return (
            <div key={idx} className="chat-code-card">
              <div className="chat-code-header">
                <span className="chat-code-lang">{block.lang || 'código'}</span>
                <CopyButton text={block.content} />
              </div>
              <pre className="chat-code-pre">
                <code>{block.content}</code>
              </pre>
            </div>
          );
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
