// animations/SprintAnimation.js — While sprinting the gun tilts off-axis and
// drops low (you can't shoot anyway: sprint cancels reloads and ADS). Smooth
// lerp in/out; an extra exaggerated pose while sliding.
// Dependencies: reads player sprint/slide state; rig applies the pose.

export class SprintAnimation {
  constructor(game) {
    this.game = game;
    this.t = 0;
  }

  update(dt) {
    const p = this.game.player;
    const want = (p.sprinting || p.sliding) ? 1 : 0;
    this.t += (want - this.t) * Math.min(1, 9 * dt);
  }

  get pose() {
    const sliding = this.game.player.sliding ? 1 : 0;
    const t = this.t;
    return {
      sprintX: -14 * t,
      sprintY: (26 + sliding * 14) * t,
      sprintRot: (0.5 + sliding * 0.25) * t,
    };
  }

  get active() {
    return this.t > 0.05;
  }
}
