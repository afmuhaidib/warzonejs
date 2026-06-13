// combat/HeadshotSystem.js — Headshot rules, consulted by weapons/Bullet on
// every entity hit. Top-down has no literal head, so "headshot" = a precision
// hit: the bullet's path passed within the head-zone fraction of the target's
// radius from dead center. Multiplier per weapon class (snipers reward
// precision most). The distinct audio cue lives in UIAudio, keyed off the
// headshot flag in the 'hit' event.
// Leaf rules module: no dependencies.

const HEAD_ZONE = 0.35;   // fraction of target radius that counts as the head

const MULTIPLIERS = { AR: 1.6, SG: 1.4, SNP: 2.0 };

export const HeadshotSystem = {
  /**
   * @param {number} missDist  closest approach of the bullet path to the
   *                           target center (px)
   * @param {object} target    entity with .radius
   */
  isHeadshot(missDist, target) {
    return missDist <= target.radius * HEAD_ZONE;
  },

  multiplier(weaponShortName) {
    return MULTIPLIERS[weaponShortName] || 1.5;
  },
};
