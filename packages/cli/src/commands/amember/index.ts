import type { CommandModule } from 'yargs';

import sync from './sync.js';

const amember: CommandModule = {
  command: 'amember <command>',
  describe: 'aMember integration commands',
  builder: (yargs) => yargs.command(sync).demandCommand(1),
};

export default amember;
