// progression/UnlockTree.js — What unlocks at which rank: weapons and
// attachments gate behind rank milestones. Consulted by the LoadoutEditor
// (greyed-out entries) and AttachmentSystem (can't equip what you haven't
// earned). Emits 'unlock' popups on rank-up.
// Dependencies: RankSystem (current rank), EventBus.

export const UNLOCKS = [
  { rank: 1, type: 'weapon', id: 'AR', name: 'M4 Carbine' },
  { rank: 2, type: 'attachment', id: 'reddot', name: 'Red Dot Sight' },
  { rank: 3, type: 'weapon', id: 'SG', name: 'Combat Shotgun' },
  { rank: 4, type: 'attachment', id: 'silencer', name: 'Silencer' },
  { rank: 5, type: 'attachment', id: 'extmag', name: 'Extended Mags' },
  { rank: 6, type: 'weapon', id: 'SNP', name: 'Marksman Rifle' },
  { rank: 7, type: 'attachment', id: 'grip', name: 'Foregrip' },
  { rank: 9, type: 'attachment', id: 'acog', name: 'ACOG Scope' },
  { rank: 11, type: 'attachment', id: 'fmj', name: 'FMJ Rounds' },
];

export class UnlockTree {
  constructor(game) {
    this.game = game;
    game.events.on('rank:up', ({ rank }) => {
      for (const u of UNLOCKS) {
        if (u.rank === rank) game.events.emit('unlock', { item: u });
      }
    });
  }

  isUnlocked(id) {
    const u = UNLOCKS.find((x) => x.id === id);
    if (!u) return true; // unknown items aren't gated
    return this.game.progression.rank.rank >= u.rank;
  }

  rankFor(id) {
    const u = UNLOCKS.find((x) => x.id === id);
    return u ? u.rank : 1;
  }
}
