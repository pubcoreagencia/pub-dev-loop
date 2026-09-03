import React from 'react';
import type { AvatarProfile, EmployeeOperationalState } from '../types/office';

interface EmployeeAvatarProps {
  avatar: AvatarProfile;
  operationalState?: EmployeeOperationalState;
  isCeo?: boolean;
  compact?: boolean;
}

export const EmployeeAvatar: React.FC<EmployeeAvatarProps> = ({
  avatar,
  operationalState = 'idle',
  isCeo = false,
  compact = false,
}) => {
  const suitColor = avatar.suitColor || (isCeo ? '#1e1b4b' : '#291e17');
  const hairColor = avatar.hairColor || '#334155';
  const tieColor = avatar.tieColor || avatar.accentColor || '#f59e0b';
  const accentColor = avatar.accentColor || '#f59e0b';

  return (
    <div className={`employee-avatar-wrapper ${compact ? 'compact' : ''} state-${operationalState}`}>
      {/* RETRO VECTOR CHARACTER */}
      <div className="character-portrait-box" style={{ borderColor: accentColor }}>
        <svg
          viewBox="0 0 64 64"
          className="character-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Sombra / Fundo */}
          <rect width="64" height="64" rx="8" fill="#140e0b" />

          {/* Cabelo (Fundo) */}
          <path d="M18 22 Q32 10 46 22 Q48 30 46 34 L18 34 Q16 30 18 22 Z" fill={hairColor} />

          {/* Cabeça / Rosto */}
          <rect x="22" y="20" width="20" height="22" rx="10" fill="#fed7aa" />

          {/* Olhos / Óculos */}
          {avatar.accessory === '👓' ? (
            <g>
              <rect x="24" y="26" width="6" height="4" rx="1" fill="none" stroke="#0f172a" strokeWidth="1.5" />
              <rect x="34" y="26" width="6" height="4" rx="1" fill="none" stroke="#0f172a" strokeWidth="1.5" />
              <line x1="30" y1="28" x2="34" y2="28" stroke="#0f172a" strokeWidth="1.5" />
            </g>
          ) : (
            <g fill="#1e293b">
              <circle cx="27" cy="28" r="1.5" />
              <circle cx="37" cy="28" r="1.5" />
            </g>
          )}

          {/* Cabelo (Frente / Franja) */}
          <path d="M20 22 Q32 14 44 22 Q40 18 32 18 Q24 18 20 22 Z" fill={hairColor} />

          {/* Corpo / Terno Anos 90 */}
          <path d="M14 60 L18 42 L26 40 L38 40 L46 42 L50 60 Z" fill={suitColor} />

          {/* Camisa Branca */}
          <polygon points="26,40 38,40 32,52" fill="#f8fafc" />

          {/* Gravata */}
          <polygon points="30,42 34,42 33,56 32,58 31,56" fill={tieColor} />

          {/* Crachá Corporativo Pendurado */}
          <rect x="23" y="47" width="6" height="8" rx="1" fill="#fff" stroke="#475569" strokeWidth="0.5" />
          <line x1="26" y1="40" x2="26" y2="47" stroke="#94a3b8" strokeWidth="0.75" />

          {/* Insígnia de Cargo */}
          <circle cx="50" cy="14" r="10" fill="#1e1713" stroke={accentColor} strokeWidth="1.5" />
          <text x="50" y="18" textAnchor="middle" fontSize="10" fill="#fff">
            {avatar.badgeIcon}
          </text>
        </svg>
      </div>

      {/* CRT WORKSTATION MONITOR AO LADO */}
      {!compact && (
        <div className={`crt-monitor-box state-${operationalState}`}>
          <div className="crt-bezel">
            <div className="crt-screen">
              {operationalState === 'working' && (
                <div className="crt-screen-content working-lines">
                  <span className="crt-line l1"></span>
                  <span className="crt-line l2"></span>
                  <span className="crt-line l3"></span>
                </div>
              )}
              {operationalState === 'thinking' && (
                <div className="crt-screen-content thinking-pulse">
                  <span className="crt-glyph">🧠</span>
                </div>
              )}
              {operationalState === 'reviewing' && (
                <div className="crt-screen-content reviewing-diff">
                  <span className="crt-diff plus">+</span>
                  <span className="crt-diff minus">-</span>
                </div>
              )}
              {operationalState === 'celebrating' && (
                <div className="crt-screen-content done-sparkle">
                  <span className="crt-glyph">✨</span>
                </div>
              )}
              {operationalState === 'blocked' && (
                <div className="crt-screen-content error-alert">
                  <span className="crt-glyph">⚠️</span>
                </div>
              )}
              {(operationalState === 'idle' || operationalState === 'waiting_for_dependency') && (
                <div className="crt-screen-content idle-prompt">
                  <span className="crt-prompt">&gt;_</span>
                </div>
              )}
            </div>
            <div className="crt-power-led"></div>
          </div>
        </div>
      )}
    </div>
  );
};
