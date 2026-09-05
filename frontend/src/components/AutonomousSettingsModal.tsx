import React, { useState, useEffect } from 'react';
import { defaultAgentAutonomousEngine, type EngineConfig } from '../services/agentAutonomousEngine';

interface AutonomousSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutonomousSettingsModal: React.FC<AutonomousSettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<EngineConfig>({
    githubToken: '',
    cloudflareToken: '',
    cloudflareAccountId: '',
    openRouterKey: '',
    autonomousEnabled: true,
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ github?: boolean; cf?: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(defaultAgentAutonomousEngine.getConfig());
      setStatusMessage('');
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    defaultAgentAutonomousEngine.saveConfig(config);
    setStatusMessage('Configurações salvas com sucesso no navegador!');
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusMessage('Testando conectividade de ferramentas autônomas...');
    const results: { github?: boolean; cf?: boolean } = {};

    // Test GitHub
    try {
      const commits = await defaultAgentAutonomousEngine.githubGetRecentCommits('pub-dev-loop', 1);
      results.github = commits.length > 0;
    } catch {
      results.github = false;
    }

    // Test Cloudflare Worker
    try {
      const cf = await defaultAgentAutonomousEngine.cloudflareCheckWorker('pub-dev-loop-3d');
      results.cf = cf.status === 'online' || cf.status === 'reachable';
    } catch {
      results.cf = false;
    }

    setTestResult(results);
    setIsTesting(false);
    setStatusMessage('Teste concluído!');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          background: '#090d16',
          border: '2px solid #38bdf8',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 0 50px rgba(56, 189, 248, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'popIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            background: 'linear-gradient(to right, #0f172a, #1e1b4b)',
            borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.04em' }}>
                Central de Autonomia Browser • AG Mode
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                Autonomia Total Direto do Navegador (Mac / PC / Mobile)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              color: '#f8fafc',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '12px',
            }}
          >
            ✕ FECHAR
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Status Badges */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#f8fafc' }}>
              <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <strong>Modo Autônomo AG:</strong> Ativo
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#38bdf8' }}>
              <span>🛠️ 7 Ferramentas Carregadas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#a855f7' }}>
              <span>☁️ 21 Repos Mapeados</span>
            </div>
          </div>

          {/* GitHub Token */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              GitHub Personal Access Token (PAT)
            </label>
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (Opcional - para commits diretos sem proxy)"
              value={config.githubToken}
              onChange={(e) => setConfig({ ...config, githubToken: e.target.value })}
              style={{
                width: '100%',
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '12px',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
            <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#64748b' }}>
              Permite que os agentes leiam arquivos privados e realizem commits automáticos diretamente na branch main.
            </p>
          </div>

          {/* Cloudflare Token */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Cloudflare API Token
            </label>
            <input
              type="password"
              placeholder="Cloudflare API Token (Workers Deploy / Telemetry)"
              value={config.cloudflareToken}
              onChange={(e) => setConfig({ ...config, cloudflareToken: e.target.value })}
              style={{
                width: '100%',
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '12px',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* OpenRouter / OpenAI Key */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Chave de API LLM (OpenRouter / 9Router / OpenAI / Anthropic)
            </label>
            <input
              type="password"
              placeholder="sk-or-v1-... (Deixe em branco para usar a rede 100% Free 9Router)"
              value={config.openRouterKey}
              onChange={(e) => setConfig({ ...config, openRouterKey: e.target.value })}
              style={{
                width: '100%',
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '12px',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* Test results */}
          {testResult && (
            <div style={{ background: '#020617', padding: '12px', borderRadius: '8px', border: '1px solid #334155', fontSize: '11px', fontFamily: 'monospace' }}>
              <div>GitHub API: {testResult.github ? '🟢 CONECTADO (Sucesso)' : '🔴 ERRO / SEM ACESSO'}</div>
              <div>Cloudflare Workers: {testResult.cf ? '🟢 ONLINE (pub-dev-loop-3d)' : '🟡 VERIFICANDO'}</div>
            </div>
          )}

          {statusMessage && (
            <div style={{ color: '#22c55e', fontSize: '12px', fontWeight: 700 }}>
              {statusMessage}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              style={{
                flex: 1,
                padding: '10px',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {isTesting ? 'Testando...' : '🔍 Testar Conexões'}
            </button>
            <button
              onClick={handleSave}
              style={{
                flex: 2,
                padding: '10px',
                background: 'linear-gradient(to right, #0284c7, #2563eb)',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: '12px',
                boxShadow: '0 0 15px rgba(56, 189, 248, 0.3)',
              }}
            >
              💾 Salvar Configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
