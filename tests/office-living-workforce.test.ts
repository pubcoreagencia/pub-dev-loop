import { describe, it, expect } from 'vitest';
import { defaultAgentRegistry } from '../src/office/registry.js';
import { defaultWatercoolerEngine } from '../frontend/src/services/watercoolerEngine.js';
import { AGENT_AVATAR_PROFILES, CEO_IDENTITY } from '../frontend/src/config/officeLayout.js';

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
    expect(reply.content).toContain('estratégico');
  });

  it('9. WatercoolerEngine responds specifically to Lucas / dev remarks with energetic tone', () => {
    const reply = defaultWatercoolerEngine.respondToCeo('Lucas, tem bug nesse deploy?', 'developer');
    expect(reply.speakerId).toBe('developer');
    expect(reply.senderName).toBe('Lucas Silveira');
    expect(reply.content).toContain('hotfix');
  });

  it('10. WatercoolerEngine responds specifically to Helena / architecture remarks', () => {
    const reply = defaultWatercoolerEngine.respondToCeo('Helena, precisamos refatorar esse módulo', 'architect');
    expect(reply.speakerId).toBe('architect');
    expect(reply.senderName).toBe('Helena Rostova');
    expect(reply.content).toContain('arquitetura limpa');
  });

  it('11. WatercoolerEngine responds specifically to Beatriz / security remarks', () => {
    const reply = defaultWatercoolerEngine.respondToCeo('Beatriz, aprova logo esse PR', 'reviewer');
    expect(reply.speakerId).toBe('reviewer');
    expect(reply.senderName).toBe('Beatriz Mendes');
    expect(reply.content).toContain('auditar');
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
    expect(reply.content).toContain('operacionais');
  });

  it('15. Rivalries and quirks are explicitly declared across all agents', () => {
    const roles = ['chief-of-staff', 'architect', 'developer', 'reviewer', 'qa-engineer'];
    roles.forEach(r => {
      expect(AGENT_AVATAR_PROFILES[r].rivalries).toBeDefined();
      expect(AGENT_AVATAR_PROFILES[r].knownQuirks?.length).toBeGreaterThan(0);
      expect(AGENT_AVATAR_PROFILES[r].backgroundLore).toBeDefined();
    });
  });
});
