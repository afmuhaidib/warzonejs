// progression/ChallengeSystem.js — Match + daily challenges. Each challenge is
// a counter driven by EventBus predicates; progress persists across sessions.
// Three "daily" challenges rotate by calendar date (seeded pick) and pay
// double XP. Completion awards XP through XPSystem and shows a popup.
// Dependencies: EventBus, XPSystem, localStorage (via RankSystem.save).

const DEFS = [
  { id: 'headhunter', name: 'Headhunter', desc: '10 headshot kills', goal: 10, xp: 500,
    on: 'hit', test: (e) => e.byTeam === 'player' && e.killed && e.headshot },
  { id: 'bladework', name: 'Bladework', desc: '3 knife kills', goal: 3, xp: 400,
    on: 'hit', test: (e) => e.byTeam === 'player' && e.killed && e.melee },
  { id: 'marksman', name: 'Marksman', desc: '15 sniper kills', goal: 15, xp: 600,
    on: 'hit', test: (e) => e.byTeam === 'player' && e.killed && e.weapon === 'SNP' },
  { id: 'pointman', name: 'Pointman', desc: '8 objective plays', goal: 8, xp: 450,
    on: 'mode:objective', test: () => true },
  { id: 'rampage', name: 'Rampage', desc: 'Earn 5 killstreak rewards', goal: 5, xp: 500,
    on: 'killstreak:earned', test: () => true },
  { id: 'exterminator', name: 'Exterminator', desc: '50 kills', goal: 50, xp: 700,
    on: 'enemy:killed', test: (e) => e.by && e.by.team === 'player' },
  { id: 'demolition', name: 'Demolition', desc: '5 explosive kills', goal: 5, xp: 450,
    on: 'enemy:killed', test: (e, game) => e.by === game.player && !!e.explosive },
];

export class ChallengeSystem {
  constructor(game) {
    this.game = game;
    const saved = game.progression.rank.load();
    this.progress = saved.challenges || {};
    this.done = new Set(saved.completedChallenges || []);

    // Daily rotation: 3 picks seeded by the date.
    const day = Math.floor(Date.now() / 86400000);
    this.dailyIds = [0, 1, 2].map((i) => DEFS[(day * 7 + i * 3) % DEFS.length].id);

    for (const def of DEFS) {
      game.events.on(def.on, (payload) => this.bump(def, payload));
    }
  }

  get defs() { return DEFS; }
  isDaily(id) { return this.dailyIds.includes(id); }
  progressOf(id) { return this.progress[id] || 0; }
  isDone(id) { return this.done.has(id); }

  bump(def, payload) {
    if (this.done.has(def.id)) return;
    if (!def.test(payload, this.game)) return;
    this.progress[def.id] = (this.progress[def.id] || 0) + 1;
    if (this.progress[def.id] >= def.goal) {
      this.done.add(def.id);
      const xp = def.xp * (this.isDaily(def.id) ? 2 : 1);
      this.game.progression.xp.award(xp, `CHALLENGE: ${def.name.toUpperCase()}`);
      this.game.events.emit('unlock', { item: { name: `${def.name} complete!`, type: 'challenge' } });
    }
    this.save();
  }

  save() {
    this.game.progression.rank.save({
      challenges: this.progress,
      completedChallenges: [...this.done],
    });
  }
}
