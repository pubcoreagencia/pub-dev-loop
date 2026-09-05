import React from 'react';

interface PubRecLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'dark' | 'light';
  showSubtitle?: boolean;
  showGridLines?: boolean;
  className?: string;
}

export const PubRecLogo: React.FC<PubRecLogoProps> = ({
  size = 'md',
  variant = 'light',
  showSubtitle = true,
  showGridLines = true,
  className = '',
}) => {
  const scale = size === 'sm' ? 0.6 : size === 'md' ? 1 : size === 'lg' ? 1.5 : 2.2;
  const textColor = variant === 'light' ? '#ffffff' : '#09090b';
  const gridColor = variant === 'light' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)';
  const subtitleColor = variant === 'light' ? '#e2e8f0' : '#27272a';

  return (
    <div
      className={`pub-rec-logo-wrapper ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
        padding: `${6 * scale}px ${12 * scale}px`,
      }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {/* Architectural Grid Lines (like blueprint) */}
        {showGridLines && (
          <svg
            style={{
              position: 'absolute',
              inset: -8 * scale,
              width: `calc(100% + ${16 * scale}px)`,
              height: `calc(100% + ${16 * scale}px)`,
              pointerEvents: 'none',
              opacity: 0.65,
            }}
          >
            <line x1="0" y1="25%" x2="100%" y2="25%" stroke={gridColor} strokeWidth="1" strokeDasharray="2,2" />
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke={gridColor} strokeWidth="1" />
            <line x1="0" y1="75%" x2="100%" y2="75%" stroke={gridColor} strokeWidth="1" strokeDasharray="2,2" />
            <line x1="28%" y1="0" x2="28%" y2="100%" stroke={gridColor} strokeWidth="1" strokeDasharray="2,2" />
            <line x1="58%" y1="0" x2="58%" y2="100%" stroke={gridColor} strokeWidth="1" />
            <line x1="88%" y1="0" x2="88%" y2="100%" stroke={gridColor} strokeWidth="1" strokeDasharray="2,2" />
          </svg>
        )}

        {/* Wordmark: pub rec */}
        <div style={{ display: 'flex', alignItems: 'baseline', letterSpacing: '-0.06em', position: 'relative' }}>
          <span
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontWeight: 900,
              fontSize: `${38 * scale}px`,
              lineHeight: 0.9,
              color: textColor,
              textTransform: 'lowercase',
            }}
          >
            pub
          </span>
          <span
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontWeight: 900,
              fontSize: `${38 * scale}px`,
              lineHeight: 0.9,
              marginLeft: `${4 * scale}px`,
              color: textColor,
              textTransform: 'lowercase',
            }}
          >
            rec
          </span>

          {/* Distinctive Red Dot */}
          <div
            style={{
              width: `${11 * scale}px`,
              height: `${11 * scale}px`,
              borderRadius: '50%',
              backgroundColor: '#dc2626',
              boxShadow: '0 0 10px rgba(220, 38, 38, 0.7)',
              marginLeft: `${6 * scale}px`,
              marginBottom: `${14 * scale}px`,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* Subtitle: HUB DE CRIAÇÃO E PRODUÇÃO */}
      {showSubtitle && (
        <span
          style={{
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            fontSize: `${8.5 * scale}px`,
            fontWeight: 800,
            letterSpacing: `${0.18 * scale}em`,
            textTransform: 'uppercase',
            color: subtitleColor,
            marginTop: `${3 * scale}px`,
            whiteSpace: 'nowrap',
          }}
        >
          HUB DE CRIAÇÃO E PRODUÇÃO
        </span>
      )}
    </div>
  );
};
