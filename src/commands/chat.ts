import { command } from 'cleye';
import { spinner, intro, outro, text, isCancel } from '@clack/prompts';
import { cyan, green, red } from 'kolorist';
import { generateCompletion, readData } from '../helpers/completion';
import { getConfig } from '../helpers/config';
import { handleCliError } from '../helpers/error';
import { streamToIterable } from '../helpers/stream-to-iterable';

interface ChatMessage {
  role: string;
  content: string;
}

export default command(
  {
    name: 'chat',
    help: {
      description:
        'Start a new chat session to send and receive messages, continue replying until the user chooses to exit.',
    },
  },
  async () => {
    const {
      OPENAI_KEY: key,
      OPENAI_API_ENDPOINT: apiEndpoint,
      MODEL: model,
    } = await getConfig();
    const chatHistory: ChatMessage[] = [];

    console.log('');
    intro('Starting new conversation');
    const prompt = async () => {
      const msgYou = `${'You'}:`;
      const userPrompt = (await text({
        message: `${cyan(msgYou)}`,
        placeholder: `send a message ('exit' to quit)`,
        validate: (value) => {
          if (!value) return 'Please enter a prompt.';
        },
      })) as string;

      if (isCancel(userPrompt) || userPrompt === 'exit') {
        outro('Goodbye!');
        process.exit(0);
      }

      const infoSpin = spinner();
      try {
        infoSpin.start(`THINKING...`);
        chatHistory.push({
          role: 'user',
          content: userPrompt,
        });
        const { readResponse } = await getResponse({
          prompt: chatHistory,
          key: key!,
          model,
          apiEndpoint: apiEndpoint!,
        });

        infoSpin.stop(`${green('AI Shell:')}`);
        console.log('');
        const fullResponse = await readResponse(
          process.stdout.write.bind(process.stdout)
        );
        chatHistory.push({
          role: 'assistant',
          content: fullResponse,
        });
        console.log('');
        console.log('');
      } catch (error: any) {
        infoSpin.stop();
        console.error(`\n${red('✖')} ${error.message}`);
        handleCliError(error);
        process.exit(1);
      }
      prompt();
    };

    prompt();
  }
);

async function getResponse({
  prompt,
  key,
  model,
  apiEndpoint,
}: {
  prompt: string | ChatMessage[];
  model?: string;
  key: string;
  apiEndpoint: string;
}) {
  const stream = await generateCompletion({
    prompt,
    key,
    model,
    apiEndpoint,
  });

  const iterableStream = streamToIterable(stream);

  return { readResponse: readData(iterableStream) };
}
