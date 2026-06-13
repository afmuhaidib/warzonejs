// modes/ModeDefinitions.js — Shared game mode registry.
// Extracted to a leaf module to break the circular dependency between
// MainMenu (which needs the list for buttons) and GameModeManager (which
// needs the list to start matches).

import { FreeForAll } from './FreeForAll.js';
import { TeamDeathmatch } from './TeamDeathmatch.js';
import { SearchAndDestroy } from './SearchAndDestroy.js';
import { Domination } from './Domination.js';
import { CaptureTheFlag } from './CaptureTheFlag.js';

export const MODES = [
  {
    id: 'tdm',
    name: 'TEAM DEATHMATCH',
    desc: 'Your squad vs theirs. First team to 30 kills wins.',
    make: (g) => new TeamDeathmatch(g)
  },
  {
    id: 'ffa',
    name: 'FREE-FOR-ALL',
    desc: 'Every man for himself. First to 30 kills.',
    make: (g) => new FreeForAll(g)
  },
  {
    id: 'ctf',
    name: 'CAPTURE THE FLAG',
    desc: 'Grab their flag, bring it home. First to 3 captures.',
    make: (g) => new CaptureTheFlag(g)
  },
  {
    id: 'dom',
    name: 'DOMINATION',
    desc: 'Hold A/B/C. Points tick while you own them. First to 50.',
    make: (g) => new Domination(g)
  },
  {
    id: 'snd',
    name: 'SEARCH & DESTROY',
    desc: 'Plant the bomb. One life per round. First to 3 rounds.',
    make: (g) => new SearchAndDestroy(g)
  },
];
