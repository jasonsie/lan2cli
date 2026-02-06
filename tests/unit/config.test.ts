import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getConfig,
  setConfigs,
  isValidOllamaHost,
} from '../../src/helpers/config';
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

describe('Config', () => {
  const mockHomeDir = '/mock/home';
  const mockConfigPath = path.join(mockHomeDir, '.ai-shell');

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(os.userInfo).mockReturnValue({ shell: 'bash' } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return default values when config file does not exist', async () => {
    vi.mocked(fs.lstat).mockRejectedValue(new Error('File not found'));

    const config = await getConfig();

    expect(config.PROVIDER).toBe('gemini');
    expect(config.MODEL).toBe('gpt-4o-mini');
    expect(config.OLLAMA_HOST).toBe('http://localhost:11434');
  });

  it('should parse existing config file', async () => {
    vi.mocked(fs.lstat).mockResolvedValue({} as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      ini.stringify({
        PROVIDER: 'ollama',
        OLLAMA_HOST: 'http://ollama:11434',
        MODEL: 'llama3',
      })
    );

    const config = await getConfig();

    expect(config.PROVIDER).toBe('ollama');
    expect(config.OLLAMA_HOST).toBe('http://ollama:11434');
    expect(config.MODEL).toBe('llama3');
  });

  it('should validate PROVIDER value', async () => {
    vi.mocked(fs.lstat).mockResolvedValue({} as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      ini.stringify({
        PROVIDER: 'invalid-provider',
      })
    );

    await expect(getConfig()).rejects.toThrow(/Invalid provider/);
  });

  it('should not throw error for missing OPENAI_KEY', async () => {
    vi.mocked(fs.lstat).mockRejectedValue(new Error('File not found'));

    const config = await getConfig();
    expect(config.OPENAI_KEY).toBeUndefined();
    expect(config.PROVIDER).toBe('gemini');
  });

  // ============================================================
  // Phase 5: User Story 3 - Configuration Management Tests
  // ============================================================

  describe('US3: OLLAMA_HOST Configuration', () => {
    // T026: Unit test for OLLAMA_HOST validation (valid/invalid URLs)
    describe('isValidOllamaHost validation', () => {
      it('should accept valid http URL', () => {
        expect(isValidOllamaHost('http://localhost:11434')).toBe(true);
      });

      it('should accept valid https URL', () => {
        expect(isValidOllamaHost('https://ollama.example.com:11434')).toBe(
          true
        );
      });

      it('should accept URL without port', () => {
        expect(isValidOllamaHost('http://ollama.local')).toBe(true);
      });

      it('should accept URL with IP address', () => {
        expect(isValidOllamaHost('http://192.168.1.100:11434')).toBe(true);
      });

      it('should reject invalid URL without protocol', () => {
        expect(isValidOllamaHost('localhost:11434')).toBe(false);
      });

      it('should reject ftp protocol', () => {
        expect(isValidOllamaHost('ftp://ollama.local:11434')).toBe(false);
      });

      it('should reject empty string', () => {
        expect(isValidOllamaHost('')).toBe(false);
      });

      it('should reject malformed URL', () => {
        expect(isValidOllamaHost('not a url at all')).toBe(false);
      });

      it('should reject URL with spaces', () => {
        expect(isValidOllamaHost('http://local host:11434')).toBe(false);
      });
    });

    // T027: Unit test for OLLAMA_HOST persistence and retrieval
    describe('OLLAMA_HOST persistence', () => {
      it('should return default OLLAMA_HOST when not configured', async () => {
        vi.mocked(fs.lstat).mockRejectedValue(new Error('File not found'));

        const config = await getConfig();

        expect(config.OLLAMA_HOST).toBe('http://localhost:11434');
      });

      it('should return configured OLLAMA_HOST', async () => {
        vi.mocked(fs.lstat).mockResolvedValue({} as any);
        vi.mocked(fs.readFile).mockResolvedValue(
          ini.stringify({
            OLLAMA_HOST: 'http://custom:8080',
          })
        );

        const config = await getConfig();

        expect(config.OLLAMA_HOST).toBe('http://custom:8080');
      });

      it('should throw error for invalid OLLAMA_HOST in config', async () => {
        vi.mocked(fs.lstat).mockResolvedValue({} as any);
        vi.mocked(fs.readFile).mockResolvedValue(
          ini.stringify({
            OLLAMA_HOST: 'invalid-url',
          })
        );

        await expect(getConfig()).rejects.toThrow(/Invalid Ollama host URL/);
      });

      it('should persist OLLAMA_HOST when set', async () => {
        vi.mocked(fs.lstat).mockResolvedValue({} as any);
        vi.mocked(fs.readFile).mockResolvedValue(ini.stringify({}));
        vi.mocked(fs.writeFile).mockResolvedValue();

        await setConfigs([['OLLAMA_HOST', 'http://new-host:11434']]);

        expect(fs.writeFile).toHaveBeenCalledWith(
          mockConfigPath,
          expect.stringContaining('OLLAMA_HOST=http://new-host:11434'),
          'utf8'
        );
      });

      it('should reject setting invalid OLLAMA_HOST', async () => {
        vi.mocked(fs.lstat).mockResolvedValue({} as any);
        vi.mocked(fs.readFile).mockResolvedValue(ini.stringify({}));

        await expect(
          setConfigs([['OLLAMA_HOST', 'not-a-valid-url']])
        ).rejects.toThrow(/Invalid Ollama host URL/);
      });
    });

    // T028: Test for config UI prompting (behavior test, not UI test)
    describe('OLLAMA_HOST in config structure', () => {
      it('should include OLLAMA_HOST in getConfig result', async () => {
        vi.mocked(fs.lstat).mockRejectedValue(new Error('File not found'));

        const config = await getConfig();

        expect(config).toHaveProperty('OLLAMA_HOST');
      });

      it('should preserve OLLAMA_HOST when setting other values', async () => {
        vi.mocked(fs.lstat).mockResolvedValue({} as any);
        vi.mocked(fs.readFile).mockResolvedValue(
          ini.stringify({
            OLLAMA_HOST: 'http://existing:11434',
            MODEL: 'gpt-4',
          })
        );
        vi.mocked(fs.writeFile).mockResolvedValue();

        await setConfigs([['MODEL', 'gpt-4o']]);

        expect(fs.writeFile).toHaveBeenCalledWith(
          mockConfigPath,
          expect.stringContaining('OLLAMA_HOST=http://existing:11434'),
          'utf8'
        );
      });
    });

    // Additional OLLAMA_HOST edge cases
    describe('OLLAMA_HOST edge cases', () => {
      it('should accept https with custom port', async () => {
        vi.mocked(fs.lstat).mockResolvedValue({} as any);
        vi.mocked(fs.readFile).mockResolvedValue(
          ini.stringify({
            OLLAMA_HOST: 'https://secure-ollama.example.com:443',
          })
        );

        const config = await getConfig();

        expect(config.OLLAMA_HOST).toBe(
          'https://secure-ollama.example.com:443'
        );
      });

      it('should accept localhost variants', async () => {
        vi.mocked(fs.lstat).mockResolvedValue({} as any);
        vi.mocked(fs.readFile).mockResolvedValue(
          ini.stringify({
            OLLAMA_HOST: 'http://127.0.0.1:11434',
          })
        );

        const config = await getConfig();

        expect(config.OLLAMA_HOST).toBe('http://127.0.0.1:11434');
      });
    });
  });

  // ============================================================
  // Provider Configuration Tests
  // ============================================================

  describe('Provider configuration', () => {
    it('should accept openai provider', async () => {
      vi.mocked(fs.lstat).mockResolvedValue({} as any);
      vi.mocked(fs.readFile).mockResolvedValue(
        ini.stringify({
          PROVIDER: 'openai',
        })
      );

      const config = await getConfig();

      expect(config.PROVIDER).toBe('openai');
    });

    it('should accept gemini provider', async () => {
      vi.mocked(fs.lstat).mockResolvedValue({} as any);
      vi.mocked(fs.readFile).mockResolvedValue(
        ini.stringify({
          PROVIDER: 'gemini',
        })
      );

      const config = await getConfig();

      expect(config.PROVIDER).toBe('gemini');
    });

    it('should accept ollama provider', async () => {
      vi.mocked(fs.lstat).mockResolvedValue({} as any);
      vi.mocked(fs.readFile).mockResolvedValue(
        ini.stringify({
          PROVIDER: 'ollama',
        })
      );

      const config = await getConfig();

      expect(config.PROVIDER).toBe('ollama');
    });

    it('should use CLI config override', async () => {
      vi.mocked(fs.lstat).mockResolvedValue({} as any);
      vi.mocked(fs.readFile).mockResolvedValue(
        ini.stringify({
          PROVIDER: 'openai',
          OLLAMA_HOST: 'http://file-host:11434',
        })
      );

      const config = await getConfig({
        OLLAMA_HOST: 'http://cli-host:11434',
      });

      // CLI override should take precedence
      expect(config.OLLAMA_HOST).toBe('http://cli-host:11434');
    });
  });
});
