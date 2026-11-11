import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCompletion } from '../../src/helpers/completion';
import { getConfig } from '../../src/helpers/config';
import { createProvider } from '../../src/helpers/providers/index';

vi.mock('../../src/helpers/config');
vi.mock('../../src/helpers/providers/index');

describe('generateCompletion provider routing', () => {
  const providerCall = vi.fn();

  const useConfig = (config: Record<string, unknown>) =>
    vi.mocked(getConfig).mockResolvedValue(config as any);

  const run = (model?: string) =>
    generateCompletion({
      prompt: 'list files',
      key: 'openai-key',
      apiEndpoint: 'https://api.openai.com/v1',
      model,
    });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    providerCall.mockResolvedValue('stream');
    vi.mocked(createProvider).mockReturnValue({
      generateCompletion: providerCall,
      validateConfig: vi.fn(),
    });
  });

  it('uses ANTHROPIC_KEY and the configured Claude model', async () => {
    useConfig({ PROVIDER: 'anthropic', ANTHROPIC_KEY: 'sk-ant-1' });

    await run('claude-haiku-5-5');

    expect(createProvider).toHaveBeenCalledWith('anthropic');
    expect(providerCall).toHaveBeenCalledWith(
      'list files',
      expect.objectContaining({
        apiKey: 'sk-ant-1',
        model: 'claude-haiku-5-5',
      })
    );
  });

  it('passes an empty key so the SDK can use ANTHROPIC_API_KEY', async () => {
    useConfig({ PROVIDER: 'anthropic' });

    await run();

    expect(providerCall.mock.calls[0][1].apiKey).toBe('');
  });

  it('drops a non-Claude MODEL for anthropic and warns', async () => {
    useConfig({ PROVIDER: 'anthropic', ANTHROPIC_KEY: 'k' });

    await run('qwen2.5-coder:14b');

    expect(providerCall.mock.calls[0][1].model).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("'qwen2.5-coder:14b' seems incompatible")
    );
  });

  it('does not warn for the unset-MODEL placeholder', async () => {
    useConfig({ PROVIDER: 'anthropic', ANTHROPIC_KEY: 'k' });

    await run('gpt-4o-mini');

    expect(providerCall.mock.calls[0][1].model).toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('still routes OPENAI_KEY to the openai provider', async () => {
    useConfig({ PROVIDER: 'openai', ANTHROPIC_KEY: 'sk-ant-1' });

    await run('gpt-4o');

    expect(providerCall.mock.calls[0][1]).toMatchObject({
      apiKey: 'openai-key',
      model: 'gpt-4o',
    });
  });
});
