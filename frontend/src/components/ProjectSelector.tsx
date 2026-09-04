import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export const ProjectSelector: React.FC = () => {
  const {
    projects,
    activeProject,
    activeRepository,
    setActiveProject,
    fetchProjectsList,
    createNewProject,
    addMessage,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPrivate, setNewProjectPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchProjectsList();
  }, [fetchProjectsList]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectProject = (name: string, url?: string) => {
    setActiveProject(name, url);
    setIsOpen(false);
    addMessage({
      sender: 'SYSTEM',
      senderName: 'Diretoria de Engenharia',
      senderRole: 'Gerenciador de Projetos Git',
      content: `Projeto ativo alterado para: [${name}] (${url || `https://github.com/pubcoreagencia/${name}.git`}). Todos os despachos de tarefas, commits e planos agora operarão sobre este repositório no Git.`,
      type: 'SYSTEM',
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || isCreating) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const created = await createNewProject(
        newProjectName.trim(),
        newProjectDesc.trim() || undefined,
        newProjectPrivate
      );

      addMessage({
        sender: 'SYSTEM',
        senderName: 'GitHub Automation Bot',
        senderRole: 'Infraestrutura Git',
        content: `Novo repositório criado com sucesso no GitHub: ${created.fullName} (${created.cloneUrl}). O projeto foi definido como o workspace ativo do escritório.`,
        type: 'SYSTEM',
      });

      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectPrivate(false);
      setIsOpen(false);
    } catch (err: any) {
      setCreateError(err.message || 'Falha ao criar repositório no GitHub');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="project-selector-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Botão de Seleção Principal no Topo */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid #38bdf8',
          borderRadius: '6px',
          padding: '5px 12px',
          color: '#f8fafc',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.2s ease',
        }}
        title={`Projeto Ativo: ${activeProject}\nRepositório: ${activeRepository}`}
      >
        <span style={{ fontSize: '13px' }}>📂</span>
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: '1.2' }}>
          <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROJETO ATIVO</span>
          <span style={{ color: '#38bdf8', fontWeight: 700, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeProject}
          </span>
        </div>
        <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '4px' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown de Repositórios */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '320px',
            maxHeight: '420px',
            backgroundColor: '#0b0f19',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header do Dropdown */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e293b', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🐙</span> Repositórios Git
            </span>
            <button
              onClick={() => {
                setShowCreateModal(true);
                setIsOpen(false);
              }}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              + Novo Projeto
            </button>
          </div>

          {/* Campo de Busca de Repos */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e293b' }}>
            <input
              type="text"
              placeholder="Buscar repositório..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#f8fafc',
                padding: '6px 8px',
                fontSize: '11px',
                outline: 'none',
              }}
            />
          </div>

          {/* Lista de Repositórios */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
            {filteredProjects.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '11px' }}>
                Nenhum repositório encontrado
              </div>
            ) : (
              filteredProjects.map((p) => {
                const isSelected = p.name === activeProject;
                return (
                  <div
                    key={p.name}
                    onClick={() => handleSelectProject(p.name, p.cloneUrl)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      marginBottom: '2px',
                      background: isSelected ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#1e293b';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px' }}>{p.isPrivate ? '🔒' : '🌐'}</span>
                        <span style={{ color: isSelected ? '#38bdf8' : '#e2e8f0', fontWeight: isSelected ? 700 : 500, fontSize: '11px' }}>
                          {p.name}
                        </span>
                      </div>
                      {p.description && (
                        <span style={{ color: '#94a3b8', fontSize: '9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.description}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Informativo */}
          <div style={{ padding: '6px 12px', background: '#020617', borderTop: '1px solid #1e293b', fontSize: '9px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Regra PDL: Desenvolvimento e commits são sincronizados no Git</span>
          </div>
        </div>
      )}

      {/* Modal de Criação de Novo Projeto no Git */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isCreating) setShowCreateModal(false);
          }}
        >
          <div
            style={{
              width: '420px',
              maxWidth: '100%',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🚀</span>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 700 }}>
                  Criar Novo Projeto no Git
                </h3>
              </div>
              {!isCreating && (
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '16px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
              Ao criar o projeto, o PDL criará automaticamente um novo repositório oficial no GitHub sob a organização <strong>pubcoreagencia</strong> e definirá este projeto como o alvo de desenvolvimento ativo.
            </p>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Nome do Repositório *
                </label>
                <input
                  type="text"
                  placeholder="ex: pub-agent-leads ou meu-novo-app"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  disabled={isCreating}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="ex: Sistema de automação de vendas e inteligência"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  disabled={isCreating}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <input
                  type="checkbox"
                  id="private-check"
                  checked={newProjectPrivate}
                  onChange={(e) => setNewProjectPrivate(e.target.checked)}
                  disabled={isCreating}
                  style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
                />
                <label htmlFor="private-check" style={{ fontSize: '11px', color: '#cbd5e1', cursor: 'pointer' }}>
                  Repositório Privado (Default: Público)
                </label>
              </div>

              {createError && (
                <div style={{ padding: '8px 10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#f87171', fontSize: '11px' }}>
                  {createError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    padding: '6px 14px',
                    fontSize: '11px',
                    cursor: isCreating ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newProjectName.trim()}
                  style={{
                    background: isCreating ? '#475569' : 'linear-gradient(135deg, #0284c7, #2563eb)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '6px 16px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: isCreating || !newProjectName.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isCreating ? 'Criando no GitHub...' : 'Criar e Ativar Repositório'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
