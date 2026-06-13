// ai/Personality.js — Per-soldier behavioral identity. AAA shooters never ship
// a single homogeneous AI: every NPC is a slight variation so firefights feel
// populated by individuals, not clones. Each enemy is assigned one archetype at
// spawn, with a little per-instance jitter, and the archetype's multipliers
// modulate the global DifficultyScaler knobs (reaction, aim, aggression) plus a
// few behavior thresholds (retreat health, how well they lead moving targets,
// and how badly incoming fire rattles them).
// Pure data + a factory. No dependencies beyond MathUtils.

import { randRange } from '../utils/MathUtils.js';

// Each archetype is expressed as MULTIPLIERS on the difficulty baseline so the
// whole roster still scales with player score — a "Sharpshooter" is simply a
// sharper version of whatever the current difficulty already dictates.
//   aimErrorMult   <1 tighter groups, >1 sprays
//   reactionMult   <1 sees you sooner
//   aggressionMult <1 holds cover, >1 pushes
//   retreatHealth  HP threshold to break contact (raw, not a multiplier)
//   leadSkill      0..~1.1 how accurately they lead a moving target
//   suppressResist >1 keeps shooting under fire, <1 ducks easily
//   bravery        morale weight: high = avenges the squad, low = falls back
const ARCHETYPES = [
  {
    label: 'Assaulter', color: '#e0623a', weight: 3,
    aimErrorMult: 1.15, reactionMult: 0.92, aggressionMult: 1.45,
    retreatHealth: 22, leadSkill: 0.7, suppressResist: 0.85, bravery: 1.35,
  },
  {
    label: 'Rifleman', color: '#d6a13c', weight: 4,
    aimErrorMult: 1.0, reactionMult: 1.0, aggressionMult: 1.0,
    retreatHealth: 35, leadSkill: 0.85, suppressResist: 1.0, bravery: 1.0,
  },
  {
    label: 'Sharpshooter', color: '#7fb0e8', weight: 2,
    aimErrorMult: 0.68, reactionMult: 1.12, aggressionMult: 0.6,
    retreatHealth: 45, leadSkill: 1.1, suppressResist: 1.0, bravery: 0.85,
  },
  {
    label: 'Flanker', color: '#c878e8', weight: 3,
    aimErrorMult: 1.0, reactionMult: 0.85, aggressionMult: 1.15,
    retreatHealth: 35, leadSkill: 0.9, suppressResist: 0.95, bravery: 1.1,
    teamwork: 1.4, // SquadCoordinator prefers these for the flank role
  },
  {
    label: 'Veteran', color: '#8ce0a0', weight: 2,
    aimErrorMult: 0.85, reactionMult: 0.85, aggressionMult: 1.0,
    retreatHealth: 28, leadSkill: 1.0, suppressResist: 1.6, bravery: 1.45,
  },
];

const TOTAL_WEIGHT = ARCHETYPES.reduce((s, a) => s + a.weight, 0);

/** Roll one archetype (weighted) and apply small per-soldier jitter to it. */
export function makePersonality() {
  let r = Math.random() * TOTAL_WEIGHT;
  let base = ARCHETYPES[0];
  for (const a of ARCHETYPES) { r -= a.weight; if (r <= 0) { base = a; break; } }

  const j = (v, amt) => v * randRange(1 - amt, 1 + amt);
  return {
    label: base.label,
    color: base.color,
    aimErrorMult: j(base.aimErrorMult, 0.1),
    reactionMult: j(base.reactionMult, 0.1),
    aggressionMult: j(base.aggressionMult, 0.12),
    retreatHealth: Math.round(j(base.retreatHealth, 0.15)),
    leadSkill: j(base.leadSkill, 0.1),
    suppressResist: j(base.suppressResist, 0.12),
    bravery: j(base.bravery, 0.12),
    teamwork: base.teamwork || 1.0,
  };
}
