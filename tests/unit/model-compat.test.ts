import { describe, it, expect } from 'vitest';
import { resolveModel } from '../../src/helpers/model-compat';
import { unsetModelPlaceholder } from '../../src/helpers/constants';

describe('resolveModel', () => {
  it.each([
    ['anthropic', 'claude-opus-5-5'],
    ['anthropic', 'claude-haiku-5-5'],
    ['openai', 'gpt-4o'],
    ['gemini', 'gemini-3-flash-preview'],
    ['ollama', 'qwen2.5-coder:14b'],
    ['ollama', 'gpt-4o-mini'],
  ] as const)('keeps %s model %s', (provider, model) => {
    expect(resolveModel(provider, model)).toEqual({ model });
  });

  it('returns undefined for an unset model', () => {
    expect(resolveModel('anthropic', undefined)).toEqual({ model: undefined });
    expect(resolveModel('anthropic', '')).toEqual({ model: '' });
  });

  describe('anthropic accepts only claude-* names', () => {
    it.each(['gpt-4o', 'gemini-3-flash-preview', 'qwen2.5-coder:14b', 'x'])(
      'drops %s with a Claude warning',
      (model) => {
        const result = resolveModel('anthropic', model);
        expect(result.model).toBeUndefined();
        expect(result.warning).toBe(
          `Warning: Model '${model}' seems incompatible with Claude. Using default.`
        );
      }
    );
  });

  describe('other providers reject mismatched names', () => {
    it('gemini drops gpt-, text- and claude- models', () => {
      for (const model of ['gpt-4o', 'text-davinci-003', 'claude-opus-5-5']) {
        const result = resolveModel('gemini', model);
        expect(result.model).toBeUndefined();
        expect(result.warning).toContain('incompatible with Gemini');
      }
    });

    it('openai drops gemini- and claude- models', () => {
      for (const model of ['gemini-pro', 'claude-opus-5-5']) {
        const result = resolveModel('openai', model);
        expect(result.model).toBeUndefined();
        expect(result.warning).toContain('incompatible with OpenAI');
      }
    });
  });

  it('silently ignores the unset-MODEL placeholder', () => {
    for (const provider of ['anthropic', 'gemini'] as const) {
      expect(resolveModel(provider, unsetModelPlaceholder)).toEqual({
        model: undefined,
      });
    }
  });
});
