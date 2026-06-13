// animations/HandRenderer.js — Procedural gloved hands holding the viewmodel
// weapon. Two capsule-ish hands: rear hand on the grip, lead hand on the
// foregrip; either can be lifted/offset by an animation pose (the lead hand
// does all the mag work during reloads).
// Pure draw module: no state.

const GLOVE = '#2e3b27';
const GLOVE_DARK = '#22301e';

export class HandRenderer {
  /**
   * Pose fields (all optional, viewmodel-local space, applied after gun
   * transform): leadX/leadY (lead-hand offset), leadHidden, rearX/rearY.
   */
  static draw(ctx, pose) {
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.rot || 0);
    const s = pose.scale || 1;
    ctx.scale(s, s);

    // Rear hand: wraps the pistol grip.
    HandRenderer.hand(ctx, -2 + (pose.rearX || 0), 12 + (pose.rearY || 0), 8, -0.4);

    // Lead hand: on the foregrip — or off doing reload work.
    if (!pose.leadHidden) {
      HandRenderer.hand(ctx, 26 + (pose.leadX || 0), 2 + (pose.leadY || 0), 7.5, 0.3);
    }

    ctx.restore();
  }

  static hand(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // Wrist.
    ctx.fillStyle = GLOVE_DARK;
    ctx.fillRect(-r * 1.6, -r * 0.5, r * 1.4, r);
    // Fist.
    ctx.fillStyle = GLOVE;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    // Knuckle highlight.
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.arc(r * 0.25, -r * 0.25, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
