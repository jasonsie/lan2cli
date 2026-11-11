import dedent from 'dedent';
import { KnownError } from './error';
import { streamToIterable } from './stream-to-iterable';
import { detectShell } from './os-detect';
import { stripRegexPatterns } from './strip-regex-patterns';
import { createProvider } from './providers/index';
import { getConfig } from './config';
import { resolveModel } from './model-compat';

// Openai outputs markdown format for code blocks. It oftne uses
// a github style like: "```bash"
const shellCodeExclusions = [/```[a-zA-Z]*\n/gi, /```[a-zA-Z]*/gi, '\n'];

export async function getScriptAndInfo({
  prompt,
  key,
  model,
  apiEndpoint,
}: {
  prompt: string;
  key: string;
  model?: string;
  apiEndpoint: string;
}) {
  const fullPrompt = getFullPrompt(prompt);
  const stream = await generateCompletion({
    prompt: fullPrompt,
    key,
    model,
    apiEndpoint,
  });
  const iterableStream = streamToIterable(stream);
  return {
    readScript: readData(iterableStream, ...shellCodeExclusions),
    readInfo: readData(iterableStream, ...shellCodeExclusions),
  };
}

export async function generateCompletion({
  prompt,
  key,
  model,
  apiEndpoint,
}: {
  prompt: string | Array<{ role: string; content: string }>;
  model?: string;
  key: string;
  apiEndpoint: string;
}) {
  const config = await getConfig();
  const providerName = config.PROVIDER || 'openai'; // Fallback to openai if undefined (though config defaults to gemini now, existing might vary)

  // If the provider is NOT openai, we need to ensure we have the correct key.
  // The 'key' argument passed to this function is typically OPENAI_KEY from the CLI or config.
  // If we are using Gemini, we need GEMINI_KEY.
  // If we are using Anthropic, we need ANTHROPIC_KEY or ANTHROPIC_API_KEY.
  // If we are using Ollama, we don't need a key.

  let apiKey = key;
  let endpoint = apiEndpoint;

  if (providerName === 'gemini') {
    apiKey = config.GEMINI_KEY || '';
  } else if (providerName === 'ollama') {
    apiKey = ''; // No key needed usually
    endpoint = config.OLLAMA_HOST || 'http://localhost:11434';
  } else if (providerName === 'anthropic') {
    // Empty means "not in the config file": the provider then falls back to
    // the SDK's ANTHROPIC_API_KEY environment resolution.
    apiKey = config.ANTHROPIC_KEY || '';
  }

  const provider = createProvider(providerName);

  // FR-011: Warn and fallback if configured MODEL is incompatible with selected PROVIDER
  const resolved = resolveModel(providerName, model);
  if (resolved.warning) console.warn(`\n${resolved.warning}\n`);
  model = resolved.model;

  // Convert message array to string for provider interface
  let promptText = '';
  if (Array.isArray(prompt)) {
    promptText = prompt.map((m) => `${m.role}: ${m.content}`).join('\n');
  } else {
    promptText = prompt;
  }

  try {
    return await provider.generateCompletion(promptText, {
      apiKey,
      model,
      endpoint, // Use provider-specific endpoint (OLLAMA_HOST for Ollama, OPENAI_API_ENDPOINT for OpenAI)
    });
  } catch (err) {
    const error = err as any;

    if (error.code === 'ENOTFOUND') {
      throw new KnownError(
        `Error connecting to ${error.request?.hostname || 'provider'} (${
          error.request?.syscall || 'unknown'
        }). Are you connected to the internet?`
      );
    }

    // Pass through KnownErrors
    if (error instanceof KnownError) {
      throw error;
    }

    throw error;
  }
}

export async function getExplanation({
  script,
  key,
  model,
  apiEndpoint,
}: {
  script: string;
  key: string;
  model?: string;
  apiEndpoint: string;
}) {
  const prompt = getExplanationPrompt(script);
  const stream = await generateCompletion({
    prompt,
    key,
    model,
    apiEndpoint,
  });
  const iterableStream = streamToIterable(stream);
  return { readExplanation: readData(iterableStream) };
}

export async function getRevision({
  prompt,
  code,
  key,
  model,
  apiEndpoint,
}: {
  prompt: string;
  code: string;
  key: string;
  model?: string;
  apiEndpoint: string;
}) {
  const fullPrompt = getRevisionPrompt(prompt, code);
  const stream = await generateCompletion({
    prompt: fullPrompt,
    key,
    model,
    apiEndpoint,
  });
  const iterableStream = streamToIterable(stream);
  return {
    readScript: readData(iterableStream, ...shellCodeExclusions),
  };
}

export const readData =
  (
    iterableStream: AsyncGenerator<string, void>,
    ...excluded: (RegExp | string | undefined)[]
  ) =>
  (writer: (data: string) => void): Promise<string> =>
    new Promise(async (resolve) => {
      let stopTextStream = false;
      let data = '';
      let content = '';
      let dataStart = false;
      let buffer = ''; // This buffer will temporarily hold incoming data only for detecting the start

      const [excludedPrefix] = excluded;
      const stopTextStreamKeys = ['q', 'escape']; //Group of keys that stop the text stream

      process.stdin.setRawMode(true);

      process.stdin.on('keypress', (key, data) => {
        if (stopTextStreamKeys.includes(data.name)) {
          stopTextStream = true;
        }
      });
      for await (const chunk of iterableStream) {
        const payloads = chunk.toString().split('\n\n');
        for (const payload of payloads) {
          if (payload.includes('[DONE]') || stopTextStream) {
            // Flush any remaining buffered content before resolving
            if (buffer && !dataStart) {
              const bufferedContentWithoutExcluded = stripRegexPatterns(
                buffer,
                excluded
              );
              data += bufferedContentWithoutExcluded;
              writer(bufferedContentWithoutExcluded);
            }
            dataStart = false;
            resolve(data);
            return;
          }

          if (payload.startsWith('data:')) {
            content = parseContent(payload);
            // Use buffer only for start detection
            if (!dataStart) {
              // Append content to the buffer
              buffer += content;
              if (buffer.match(excludedPrefix ?? '')) {
                dataStart = true;
                // Clear the buffer once it has served its purpose
                buffer = '';
                if (excludedPrefix) break;
              } else if (excludedPrefix && buffer.length > 50) {
                // If we've accumulated content but no code block marker found,
                // assume the response doesn't have code blocks and start displaying
                dataStart = true;
                // Write the buffered content first
                const bufferedContentWithoutExcluded = stripRegexPatterns(
                  buffer,
                  excluded
                );
                data += bufferedContentWithoutExcluded;
                writer(bufferedContentWithoutExcluded);
                buffer = '';
              }
            }

            if (dataStart && content) {
              const contentWithoutExcluded = stripRegexPatterns(
                content,
                excluded
              );

              data += contentWithoutExcluded;
              writer(contentWithoutExcluded);
            }
          }
        }
      }

      function parseContent(payload: string): string {
        const data = payload.replaceAll(/(\n)?^data:\s*/g, '');
        try {
          const delta = JSON.parse(data.trim());
          return delta.choices?.[0]?.delta?.content ?? '';
        } catch (error) {
          return `Error with JSON.parse and ${payload}.\n${error}`;
        }
      }

      // Flush any remaining buffered content before final resolve
      if (buffer && !dataStart) {
        const bufferedContentWithoutExcluded = stripRegexPatterns(
          buffer,
          excluded
        );
        data += bufferedContentWithoutExcluded;
        writer(bufferedContentWithoutExcluded);
      }

      resolve(data);
    });

function getExplanationPrompt(script: string) {
  return dedent`
    ${explainScript}

    The script: ${script}
  `;
}

function getShellDetails() {
  const shellDetails = detectShell();

  return dedent`
      The target shell is ${shellDetails}
  `;
}
const shellDetails = getShellDetails();

const explainScript = dedent`
  Please provide a clear, concise description of the script, using minimal words. Outline the steps in a list format.
`;

function getOperationSystemDetails() {
  // CJS-only legacy entry point; pkgroll bundles this require.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const os = require('@nexssp/os/legacy');
  return os.name();
}
const generationDetails = dedent`
    Only reply with the single line command surrounded by three backticks. It must be able to be directly run in the target shell. Do not include any other text.

    Make sure the command runs on ${getOperationSystemDetails()} operating system.
  `;

function getFullPrompt(prompt: string) {
  return dedent`
    Create a single line command that one can enter in a terminal and run, based on what is specified in the prompt.

    ${shellDetails}

    ${generationDetails}

    The prompt is: ${prompt}
  `;
}

function getRevisionPrompt(prompt: string, code: string) {
  return dedent`
    Update the following script based on what is asked in the following prompt.

    The script: ${code}

    The prompt: ${prompt}

    ${generationDetails}
  `;
}
