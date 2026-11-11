import { command } from 'cleye';
import { dim } from 'kolorist';
import { commandName } from '../helpers/constants';

export default command(
  {
    name: 'update',
    help: {
      description: `Show how to update ${commandName} (installed from source)`,
    },
  },
  async () => {
    console.log('');
    console.log(
      `${commandName} is installed from source and is not published to npm.`
    );
    console.log('To update, run this in your clone of the repository:');
    console.log('');
    console.log(dim('  git pull && npm ci && npm run build'));
    console.log('');
  }
);
