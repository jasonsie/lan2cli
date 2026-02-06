import * as p from '@clack/prompts';
import { execaCommand } from 'execa';
import { cyan, dim } from 'kolorist';
import {
  getExplanation,
  getRevision,
  getScriptAndInfo,
} from './helpers/completion';
import { getConfig } from './helpers/config';
import { projectName } from './helpers/constants';
import clipboardy from 'clipboardy';
import { appendToShellHistory } from './helpers/shell-history';

const examples: string[] = [
  'delete all log files',
  'list js files',
  'fetch me a random joke',
  'list all commits',
];

const sample = <T>(arr: T[]): T | undefined => {
  const len = arr == null ? 0 : arr.length;
  return len ? arr[Math.floor(Math.random() * len)] : undefined;
};

async function runScript(script: string) {
  p.outro(`${'Running'}: ${script}`);
  console.log('');
  try {
    await execaCommand(script, {
      stdio: 'inherit',
      shell: process.env.SHELL || true,
    });
    appendToShellHistory(script);
  } catch (error) {
    // Nothing needed, it'll output to stderr
  }
}

async function getPrompt(prompt?: string) {
  const group = p.group(
    {
      prompt: () =>
        p.text({
          message: 'What would you like me to do?',
          placeholder: `${'e.g.'} ${sample(examples)}`,
          initialValue: prompt,
          defaultValue: 'Say hello',
          validate: (value) => {
            if (!value) return 'Please enter a prompt.';
          },
        }),
    },
    {
      onCancel: () => {
        p.cancel('Goodbye!');
        process.exit(0);
      },
    }
  );
  return (await group).prompt;
}

async function promptForRevision() {
  const group = p.group(
    {
      prompt: () =>
        p.text({
          message: 'What would you like me to change in this script?',
          placeholder: 'e.g. change the folder name',
          validate: (value) => {
            if (!value) return 'Please enter a prompt.';
          },
        }),
    },
    {
      onCancel: () => {
        p.cancel('Goodbye!');
        process.exit(0);
      },
    }
  );
  return (await group).prompt;
}

export async function prompt({
  usePrompt,
  silentMode,
}: { usePrompt?: string; silentMode?: boolean } = {}) {
  const {
    OPENAI_KEY: key,
    SILENT_MODE,
    OPENAI_API_ENDPOINT: apiEndpoint,
    MODEL: model,
  } = await getConfig();
  const skipCommandExplanation = silentMode || SILENT_MODE;

  console.log('');
  p.intro(`${cyan(`${projectName}`)}`);

  const thePrompt = usePrompt || (await getPrompt());
  const spin = p.spinner();
  spin.start(`Loading...`);
  const { readInfo, readScript } = await getScriptAndInfo({
    prompt: thePrompt,
    key: key!,
    model: model!,
    apiEndpoint: apiEndpoint!,
  });
  spin.stop(`${'Your script'}:`);
  console.log('');
  const script = await readScript(process.stdout.write.bind(process.stdout));
  console.log('');
  console.log('');
  console.log(dim('•'));
  if (!skipCommandExplanation) {
    spin.start(`Getting explanation...`);
    const info = await readInfo(process.stdout.write.bind(process.stdout));
    if (!info) {
      const { readExplanation } = await getExplanation({
        script,
        key: key!,
        model: model!,
        apiEndpoint: apiEndpoint!,
      });
      spin.stop(`${'Explanation'}:`);
      console.log('');
      await readExplanation(process.stdout.write.bind(process.stdout));
      console.log('');
      console.log('');
      console.log(dim('•'));
    }
  }

  await runOrReviseFlow(script, key!, model!, apiEndpoint!, silentMode);
}

async function runOrReviseFlow(
  script: string,
  key: string,
  model: string,
  apiEndpoint: string,
  silentMode?: boolean
) {
  const emptyScript = script.trim() === '';

  const answer: symbol | (() => any) = await p.select({
    message: emptyScript ? 'Revise this script?' : 'Run this script?',
    options: [
      ...(emptyScript
        ? []
        : [
            {
              label: '✅ ' + 'Yes',
              hint: 'Lets go!',
              value: async () => {
                await runScript(script);
              },
            },
            {
              label: '📝 ' + 'Edit',
              hint: 'Make some adjustments before running',
              value: async () => {
                const newScript = await p.text({
                  message: 'you can edit script here:',
                  initialValue: script,
                });
                if (!p.isCancel(newScript)) {
                  await runScript(newScript);
                }
              },
            },
          ]),
      {
        label: '🔁 ' + 'Revise',
        hint: 'Give feedback via prompt and get a new result',
        value: async () => {
          await revisionFlow(script, key, model, apiEndpoint, silentMode);
        },
      },
      {
        label: '📋 ' + 'Copy',
        hint: 'Copy the generated script to your clipboard',
        value: async () => {
          await clipboardy.write(script);
          p.outro('Copied to clipboard!');
        },
      },
      {
        label: '❌ ' + 'Cancel',
        hint: 'Exit the program',
        value: () => {
          p.cancel('Goodbye!');
          process.exit(0);
        },
      },
    ],
  });

  if (typeof answer === 'function') {
    await answer();
  }
}

async function revisionFlow(
  currentScript: string,
  key: string,
  model: string,
  apiEndpoint: string,
  silentMode?: boolean
) {
  const revision = await promptForRevision();
  const spin = p.spinner();
  spin.start(`Loading...`);
  const { readScript } = await getRevision({
    prompt: revision,
    code: currentScript,
    key,
    model,
    apiEndpoint,
  });
  spin.stop(`${`Your new script`}:`);

  console.log('');
  const script = await readScript(process.stdout.write.bind(process.stdout));
  console.log('');
  console.log('');
  console.log(dim('•'));

  if (!silentMode) {
    const infoSpin = p.spinner();
    infoSpin.start(`Getting explanation...`);
    const { readExplanation } = await getExplanation({
      script,
      key,
      model,
      apiEndpoint,
    });

    infoSpin.stop(`${'Explanation'}:`);
    console.log('');
    await readExplanation(process.stdout.write.bind(process.stdout));
    console.log('');
    console.log('');
    console.log(dim('•'));
  }

  await runOrReviseFlow(script, key!, model!, apiEndpoint!, silentMode);
}
