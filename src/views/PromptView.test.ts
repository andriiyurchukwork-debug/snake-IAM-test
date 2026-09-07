import { describe, expect, it } from 'vitest';
import { PromptView } from './PromptView';

describe('PromptView', () => {
  it('sets the prompt text and toggles overlay visibility', () => {
    const overlay = document.createElement('div');
    const textElement = document.createElement('p');
    const view = new PromptView(overlay, textElement);

    view.show('Do you want to play?');

    expect(textElement.textContent).toBe('Do you want to play?');
    expect(overlay.classList.contains('visible')).toBe(true);

    view.hide();

    expect(overlay.classList.contains('visible')).toBe(false);
  });
});
