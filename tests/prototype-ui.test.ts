import { describe, expect, it } from 'vitest';
import { prototypeUiHtml } from '../src/prototype/ui.js';

describe('Prototype UI', () => {
  it('renders a split chat and live preview workspace', () => {
    const html = prototypeUiHtml();
    expect(html).toContain('PUB Prototype');
    expect(html).toContain('Live Preview');
    expect(html).toContain('EventSource');
    expect(html).toContain('/prototype/sessions/');
    expect(html).toContain('iframe');
    expect(html).toContain('Monte um sistema para gerenciamento de uma barbearia');
    expect(html).toContain('Version History');
    expect(html).toContain('Restaurar');
  });
});
