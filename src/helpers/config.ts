import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ini from 'ini';
import { unsetModelPlaceholder } from './constants';
import { KnownError, handleCliError } from './error';
import * as p from '@clack/prompts';
import { red } from 'kolorist';
import { ProviderName } from './providers/types';

const { hasOwnProperty } = Object.prototype;
export const hasOwn = (object: unknown, key: PropertyKey) =>
  hasOwnProperty.call(object, key);

const parseAssert = (name: string, condition: any, message: string) => {
  if (!condition) {
    throw new KnownError(`${'Invalid config property'} ${name}: ${message}`);
  }
};

/**
 * Validates that a string is a valid Ollama host URL (http or https)
 */
export const isValidOllamaHost = (host: string): boolean => {
  try {
    const url = new URL(host);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const configParsers = {
  OPENAI_KEY(key?: string) {
    return key;
  },
  MODEL(model?: string) {
    if (!model || model.length === 0) {
      return unsetModelPlaceholder;
    }

    return model;
  },
  SILENT_MODE(mode?: string) {
    return String(mode).toLowerCase() === 'true';
  },
  OPENAI_API_ENDPOINT(apiEndpoint?: string) {
    return apiEndpoint || 'https://api.openai.com/v1';
  },
  PROVIDER(provider?: string) {
    if (!provider || provider.length === 0) {
      return 'gemini';
    }
    const allowedProviders: string[] = [
      'openai',
      'gemini',
      'ollama',
      'anthropic',
    ];
    if (!allowedProviders.includes(provider)) {
      throw new KnownError(
        `${'Invalid provider'}: ${provider}. ${'Allowed providers'}: ${allowedProviders.join(
          ', '
        )}`
      );
    }
    return provider as ProviderName;
  },
  GEMINI_KEY(key?: string) {
    return key;
  },
  ANTHROPIC_KEY(key?: string) {
    return key;
  },
  OLLAMA_HOST(host?: string) {
    if (!host) {
      return 'http://localhost:11434';
    }
    // Validate URL format
    if (!isValidOllamaHost(host)) {
      throw new KnownError(
        `${'Invalid Ollama host URL'}: ${host}. ${'Must be a valid http:// or https:// URL'}`
      );
    }
    return host;
  },
} as const;

type ConfigKeys = keyof typeof configParsers;

type RawConfig = {
  [key in ConfigKeys]?: string;
};

type ValidConfig = {
  [Key in ConfigKeys]: ReturnType<(typeof configParsers)[Key]>;
};

const configPath = path.join(os.homedir(), '.ai-shell');

const fileExists = (filePath: string) =>
  fs.lstat(filePath).then(
    () => true,
    () => false
  );

const readConfigFile = async (): Promise<RawConfig> => {
  const configExists = await fileExists(configPath);
  if (!configExists) {
    return Object.create(null);
  }

  const configString = await fs.readFile(configPath, 'utf8');
  return ini.parse(configString);
};

export const getConfig = async (
  cliConfig?: RawConfig
): Promise<ValidConfig> => {
  const config = await readConfigFile();
  const parsedConfig: Record<string, unknown> = {};

  for (const key of Object.keys(configParsers) as ConfigKeys[]) {
    const parser = configParsers[key];
    const value = cliConfig?.[key] ?? config[key];
    parsedConfig[key] = parser(value);
  }

  return parsedConfig as ValidConfig;
};

export const setConfigs = async (keyValues: [key: string, value: string][]) => {
  const config = await readConfigFile();

  for (const [key, value] of keyValues) {
    if (!hasOwn(configParsers, key)) {
      throw new KnownError(`${'Invalid config property'}: ${key}`);
    }

    const parsed = configParsers[key as ConfigKeys](value);
    config[key as ConfigKeys] = parsed as any;
  }

  await fs.writeFile(configPath, ini.stringify(config), 'utf8');
};

export const showConfigUI = async () => {
  try {
    const config = await getConfig();
    const choice = (await p.select({
      message: 'Set config' + ':',
      options: [
        {
          label: 'Provider',
          value: 'PROVIDER',
          hint: hasOwn(config, 'PROVIDER') ? config.PROVIDER : 'gemini',
        },
        {
          label: 'OpenAI Key',
          value: 'OPENAI_KEY',
          hint: config.OPENAI_KEY
            ? // Obfuscate the key
              'sk-...' + config.OPENAI_KEY.slice(-3)
            : '(not set)',
        },
        {
          label: 'Gemini Key',
          value: 'GEMINI_KEY',
          hint: config.GEMINI_KEY
            ? // Obfuscate the key
              '...' + config.GEMINI_KEY.slice(-3)
            : '(not set)',
        },
        {
          label: 'Anthropic Key',
          value: 'ANTHROPIC_KEY',
          hint: config.ANTHROPIC_KEY
            ? // Obfuscate the key
              '...' + config.ANTHROPIC_KEY.slice(-3)
            : '(not set)',
        },
        {
          label: 'Ollama Host',
          value: 'OLLAMA_HOST',
          hint: hasOwn(config, 'OLLAMA_HOST')
            ? config.OLLAMA_HOST
            : 'http://localhost:11434',
        },
        {
          label: 'OpenAI API Endpoint',
          value: 'OPENAI_API_ENDPOINT',
          hint: hasOwn(config, 'OPENAI_API_ENDPOINT')
            ? config.OPENAI_API_ENDPOINT
            : '(not set)',
        },
        {
          label: 'Silent Mode',
          value: 'SILENT_MODE',
          hint: hasOwn(config, 'SILENT_MODE')
            ? config.SILENT_MODE.toString()
            : '(not set)',
        },
        {
          label: 'Model',
          value: 'MODEL',
          hint: hasOwn(config, 'MODEL') ? config.MODEL : '(not set)',
        },
        {
          label: 'Cancel',
          value: 'cancel',
          hint: 'Exit the program',
        },
      ],
    })) as ConfigKeys | 'cancel' | symbol;

    if (p.isCancel(choice)) return;

    if (choice === 'PROVIDER') {
      const provider = await p.select({
        message: 'Select a provider',
        options: [
          { value: 'gemini', label: 'Google Gemini' },
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic Claude' },
          { value: 'ollama', label: 'Ollama (Local)' },
        ],
      });
      if (p.isCancel(provider)) return;
      await setConfigs([['PROVIDER', provider as string]]);
    } else if (choice === 'GEMINI_KEY') {
      const key = await p.text({
        message: 'Enter your Gemini API key',
        validate: (value) => {
          if (!value.length) {
            return 'Please enter a key';
          }
        },
      });
      if (p.isCancel(key)) return;
      await setConfigs([['GEMINI_KEY', key]]);
    } else if (choice === 'ANTHROPIC_KEY') {
      const key = await p.text({
        message: 'Enter your Anthropic API key',
        validate: (value) => {
          if (!value.length) {
            return 'Please enter a key';
          }
        },
      });
      if (p.isCancel(key)) return;
      await setConfigs([['ANTHROPIC_KEY', key]]);
    } else if (choice === 'OLLAMA_HOST') {
      const host = await p.text({
        message: 'Enter your Ollama Host URL',
        initialValue: 'http://localhost:11434',
      });
      if (p.isCancel(host)) return;
      await setConfigs([['OLLAMA_HOST', host]]);
    } else if (choice === 'OPENAI_KEY') {
      const key = await p.text({
        message: 'Enter your OpenAI API key',
        validate: (value) => {
          if (!value.length) {
            return 'Please enter a key';
          }
        },
      });
      if (p.isCancel(key)) return;
      await setConfigs([['OPENAI_KEY', key]]);
    } else if (choice === 'OPENAI_API_ENDPOINT') {
      const apiEndpoint = await p.text({
        message: 'Enter your OpenAI API Endpoint',
      });
      if (p.isCancel(apiEndpoint)) return;
      await setConfigs([['OPENAI_API_ENDPOINT', apiEndpoint]]);
    } else if (choice === 'SILENT_MODE') {
      const silentMode = await p.confirm({
        message: 'Enable silent mode?',
      });
      if (p.isCancel(silentMode)) return;
      await setConfigs([['SILENT_MODE', silentMode ? 'true' : 'false']]);
    } else if (choice === 'MODEL') {
      const model = await p.text({
        message: 'Enter model name',
        placeholder: 'gpt-4o-mini',
      });
      if (p.isCancel(model)) return;
      await setConfigs([['MODEL', model]]);
    }
    if (choice === 'cancel') return;
    showConfigUI();
  } catch (error: any) {
    console.error(`\n${red('✖')} ${error.message}`);
    handleCliError(error);
    process.exit(1);
  }
};
