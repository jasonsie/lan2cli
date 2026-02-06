import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConfig, setConfigs } from '../../src/helpers/config';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ini from 'ini';

vi.mock('os', () => ({
  default: {
    homedir: vi.fn().mockReturnValue('/mock/home'),
    userInfo: vi.fn().mockReturnValue({ shell: 'bash' }),
    platform: vi.fn().mockReturnValue('linux'),
  },
  homedir: vi.fn().mockReturnValue('/mock/home'),
  userInfo: vi.fn().mockReturnValue({ shell: 'bash' }),
  platform: vi.fn().mockReturnValue('linux'),
}));
vi.mock('fs/promises');

describe('Provider Switching Integration', () => {
  const mockHomeDir = '/mock/home';
  const mockConfigPath = path.join(mockHomeDir, '.ai-shell');

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(os.userInfo).mockReturnValue({ shell: 'bash' } as any);
    vi.mocked(fs.lstat).mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should switch provider when config is updated', async () => {
    // 1. Initial state: OpenAI
    vi.mocked(fs.readFile).mockResolvedValue(
      ini.stringify({
        PROVIDER: 'openai',
        OPENAI_KEY: 'sk-test',
      })
    );
    let config = await getConfig();
    expect(config.PROVIDER).toBe('openai');

    // 2. Change to Gemini (Simulate setConfigs writing to file, then read it back)
    // Since we mock readFile, we need to update what it returns if we want to simulate the read.
    // However, setConfigs writes to file.

    // Let's test `getConfig` logic specifically.
    vi.mocked(fs.readFile).mockResolvedValue(
      ini.stringify({
        PROVIDER: 'gemini',
        GEMINI_KEY: 'gemini-key',
      })
    );
    config = await getConfig();
    expect(config.PROVIDER).toBe('gemini');
    expect(config.GEMINI_KEY).toBe('gemini-key');

    // 3. Change to Ollama
    vi.mocked(fs.readFile).mockResolvedValue(
      ini.stringify({
        PROVIDER: 'ollama',
      })
    );
    config = await getConfig();
    expect(config.PROVIDER).toBe('ollama');
  });

  it('should fallback to default provider if config is missing', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(''); // Empty config
    const config = await getConfig();
    expect(config.PROVIDER).toBe('gemini'); // Default is now Gemini per spec
  });
});
