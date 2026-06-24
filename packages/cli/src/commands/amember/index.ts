import { noop } from '@silverhand/essentials';
import type { CommandModule } from 'yargs';

import sync from './sync.js';

const amember: CommandModule = {
  command: 'amember <command>',
  describe: 'aMember integration commands',
  builder: (yargs) => yargs.command(sync).demandCommand(1),
  handler: noop,
};

export default amember;
