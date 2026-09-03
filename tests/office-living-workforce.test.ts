import { describe, it, expect } from 'vitest';
import { defaultAgentRegistry } from '../src/office/registry.js';
import { defaultWatercoolerEngine } from '../frontend/src/services/watercoolerEngine.js';
import { AGENT_AVATAR_PROFILES, CEO_IDENTITY } from '../frontend/src/config/officeLayout.js';
import { VINYL_ALBUMS } from '../frontend/src/components/VinylJukeboxModal.js';

describe('PDL — Phase 9.0: The Living 3D Office & Workforce Personas Suite', () => {
  it('1. CEO identity is configured with Matheus Paes and Sovereign Director title', () => {
    expect(CEO_IDENTITY.name).toBe('Matheus Paes');
    expect(CEO_IDENTITY.role).toBe('CEO');
    expect(CEO_IDENTITY.avatar.nickname).toBe('O Comandante');
    expect(CEO_IDENTITY.avatar.drinkPreference).toContain('Espresso');
  });

  it('2. Chief of Staff persona is Dr. Arthur Vance with strategy lore', () => {
    const cs = defaultAgentRegistry.getAgent('chief-of-staff');
    expect(cs?.name).toBe('Dr. Arthur Vance');
    expect(AGENT_AVATAR_PROFILES['chief-of-staff'].age).toBe(52);
    expect(AGENT_AVATAR_PROFILES['chief-of-staff'].catchphrase).toContain('Alinhamento');
  });

  it('3. Architect persona is Helena Rostova with Vektor nickname', () => {
    const arch = defaultAgentRegistry.getAgent('architect');
    expect(arch?.name).toBe('Helena Rostova');
    expect(AGENT_AVATAR_PROFILES.architect.nickname).toBe('Vektor');
    expect(AGENT_AVATAR_PROFILES.architect.drinkPreference).toContain('Earl Grey');
  });

  it('4. Developer persona is Lucas Silveira with Crash nickname and high typing speed lore', () => {
    const dev = defaultAgentRegistry.getAgent('developer');
    expect(dev?.name).toBe('Lucas Silveira');
    expect(AGENT_AVATAR_PROFILES.developer.nickname).toBe('Crash');
    expect(AGENT_AVATAR_PROFILES.developer.catchphrase).toContain('minha máquina');
  });

  it('5. Reviewer persona is Beatriz Mendes with Sentinel nickname and security background', () => {
    const rev = defaultAgentRegistry.getAgent('reviewer');
    expect(rev?.name).toBe('Beatriz Mendes');
    expect(AGENT_AVATAR_PROFILES.reviewer.nickname).toBe('Sentinel');
    expect(AGENT_AVATAR_PROFILES.reviewer.drinkPreference).toContain('matcha');
  });

  it('6. QA Engineer persona is Tiago Rocha with Chaos nickname and rubber duck lore', () => {
    const qa = defaultAgentRegistry.getAgent('qa-engineer');
    expect(qa?.name).toBe('Tiago Rocha');
    expect(AGENT_AVATAR_PROFILES['qa-engineer'].nickname).toBe('Chaos');
    expect(AGENT_AVATAR_PROFILES['qa-engineer'].knownQuirks?.[0]).toContain('patinhos');
  });

  it('7. WatercoolerEngine cycles through predefined organic banter', () => {
    const d1 = defaultWatercoolerEngine.getNextDialogue();
    expect(d1.length).toBeGreaterThan(0);
    expect(d1[0].speakerId).toBeDefined();
    expect(d1[0].content.length).toBeGreaterThan(10);
  });

  it('8. WatercoolerEngine responds specifically to Dr. Arthur Vance / planning remarks', () => {
    const reply = defaultWatercoolerEngine.respondToCeo('Arthur, qual o plano de sprint?', 'chief-of-staff');
    expect(reply.speakerId).toBe('chief-of-staff');
    expect(reply.senderName).toBe('Dr. Arthur Vance');
    expect(reply.content).toContain('Alinhamento');
  });

  it('9. WatercoolerEngine responds specifically to Lucas / dev remarks with energetic tone', () => {
    const reply = defaultWatercoolerEngine.respondToCeo('Lucas, tem bug nesse deploy?', 'developer');
    expect(reply.speakerId).toBe('developer');
    expect(reply.senderName).toBe('Lucas Silveira');
    expect(reply.content).toContain('140 WPM');
  });

  it('10. WatercoolerEngine responds specifically to Helena / architecture remarks', () => {
    const reply = defaultWatercoolerEngine.respondToCeo('Helena, precisamos refatorar esse módulo', 'architect');
    expect(reply.speakerId).toBe('architect');
    expect(reply.senderName).toBe('Helena Rostova');
    expect(reply.content).toContain('diagramas');
  });

  it('11. WatercoolerEngine responds specifically to Beatriz / security remarks', () => {
    const reply = defaultWatercoolerEngine.respondToCeo('Beatriz, aprova logo esse PR', 'reviewer');
    expect(reply.speakerId).toBe('reviewer');
    expect(reply.senderName).toBe('Beatriz Mendes');
    expect(reply.content).toContain('Sentinel');
  });

  it('12. WatercoolerEngine responds specifically to Tiago / QA chaos remarks', () => {
    const reply = defaultWatercoolerEngine.respondToCeo('Tiago, quebra esse sistema no teste', 'qa-engineer');
    expect(reply.speakerId).toBe('qa-engineer');
    expect(reply.senderName).toBe('Tiago Rocha');
    expect(reply.content).toContain('Chaos Monkey');
  });

  it('13. All 5 workforce roles have unique distinct accent colors and avatar styles', () => {
    const roles = ['chief-of-staff', 'architect', 'developer', 'reviewer', 'qa-engineer'];
    const colors = new Set(roles.map(r => AGENT_AVATAR_PROFILES[r].accentColor));
    expect(colors.size).toBe(roles.length);
  });

  it('14. Default response handles general team remarks gracefully', () => {
    const reply = defaultWatercoolerEngine.respondToCeo('Bom dia time!');
    expect(reply.speakerId).toBe('chief-of-staff');
    expect(reply.content).toContain('CEO Matheus');
  });

  it('15. Rivalries and quirks are explicitly declared across all agents', () => {
    const roles = ['chief-of-staff', 'architect', 'developer', 'reviewer', 'qa-engineer'];
    roles.forEach(r => {
      expect(AGENT_AVATAR_PROFILES[r].rivalries).toBeDefined();
      expect(AGENT_AVATAR_PROFILES[r].knownQuirks?.length).toBeGreaterThan(0);
      expect(AGENT_AVATAR_PROFILES[r].backgroundLore).toBeDefined();
    });
  });

  it('16. Watercooler generates rich multi-agent reaction for leisure questions (e.g. piscina)', () => {
    const replies = defaultWatercoolerEngine.generateMultiAgentReaction('Alguém gosta de piscina?');
    expect(replies.length).toBe(5);
    // Developer wants to code by the pool
    expect(replies.some(r => r.speakerId === 'developer' && r.content.includes('notebook'))).toBe(true);
    // Architect warns about water and circuits
    expect(replies.some(r => r.speakerId === 'architect' && r.content.includes('Sibéria'))).toBe(true);
    // QA brings rubber ducks
    expect(replies.some(r => r.speakerId === 'qa-engineer' && r.content.includes('patinhos'))).toBe(true);
    // Reviewer warns about safety
    expect(replies.some(r => r.speakerId === 'reviewer')).toBe(true);
    // Chief of Staff considers team building
    expect(replies.some(r => r.speakerId === 'chief-of-staff')).toBe(true);
  });

  it('17. Watercooler generates multi-agent food and coffee discussions with past bet memories', () => {
    const replies = defaultWatercoolerEngine.generateMultiAgentReaction('Quem vai pagar a pizza hoje?');
    expect(replies.length).toBeGreaterThanOrEqual(3);
    expect(replies.some(r => r.speakerId === 'developer' && r.content.includes('pizza'))).toBe(true);
    expect(replies.some(r => r.speakerId === 'reviewer' && r.content.includes('aposta'))).toBe(true);
  });

  it('18. Social episodic memory records conversations and persists topics', () => {
    defaultWatercoolerEngine.generateMultiAgentReaction('Vamos fazer uma viagem de time para a praia?');
    const memories = defaultWatercoolerEngine.getMemories();
    expect(memories.length).toBeGreaterThan(0);
    const lastMemory = memories[memories.length - 1];
    expect(lastMemory.topic).toContain('Lazer');
  });

  it('19. Vinyl Jukebox contains 6 curated albums with distinct genres and artwork', () => {
    expect(VINYL_ALBUMS.length).toBe(6);
    const genres = VINYL_ALBUMS.map(a => a.genre);
    expect(genres.some(g => g.includes('Synthwave'))).toBe(true);
    expect(genres.some(g => g.includes('Jazz'))).toBe(true);
    expect(genres.some(g => g.includes('8-Bit'))).toBe(true);
  });

  it('20. Open-ended discussion generates multi-agent debate quoting the CEO prompt', () => {
    const replies = defaultWatercoolerEngine.generateMultiAgentReaction('O que vocês acham de adotar WebAssembly?');
    expect(replies.length).toBe(5);
    expect(replies.some(r => r.speakerId === 'developer')).toBe(true);
    expect(replies.some(r => r.speakerId === 'architect')).toBe(true);
  });
});
