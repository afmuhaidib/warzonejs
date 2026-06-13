// animations/ViewmodelRig.js — Orchestrates the whole viewmodel: owns every
// animation controller, sums their pose contributions each frame, and draws
// hands + gun (or knife) anchored to the bottom-right of the screen. Continuous
// controllers (bob, sprint, ADS, recoil) blend additively; timeline anims
// (reload, swap, melee) layer on top. Drawn screen-space, after the world pass,
// before the HUD.
// Dependencies: all animations/* modules, GunRenderer, HandRenderer.

import { GunRenderer } from './GunRenderer.js';
import { HandRenderer } from './HandRenderer.js';
import { WalkBobAnimation } from './WalkBobAnimation.js';
import { SprintAnimation } from './SprintAnimation.js';
import { FireAnimation } from './FireAnimation.js';
import { AimDownSights } from './AimDownSights.js';
import { ReloadAnimation } from './ReloadAnimation.js';
import { WeaponSwapAnimation } from './WeaponSwapAnimation.js';
import { MeleeAnimation } from './MeleeAnimation.js';

export class ViewmodelRig {
  constructor(game) {
    this.game = game;
    this.bob = new WalkBobAnimation(game);
    this.sprint = new SprintAnimation(game);
    this.fire = new FireAnimation(game);
    this.ads = new AimDownSights(game);
    this.reload = new ReloadAnimation(game);
    this.swap = new WeaponSwapAnimation(game);
    this.melee = new MeleeAnimation(game);
  }

  update(dt) {
    this.bob.update(dt);
    this.sprint.update(dt);
    this.fire.update(dt);
    this.ads.update(dt);
    this.reload.update(dt);
    this.swap.update(dt);
    this.melee.update(dt);
  }

  draw(ctx) {
    const game = this.game;
    if (!game.player.alive) return;

    const W = game.canvas.width, H = game.canvas.height;
    const b = this.bob.pose, s = this.sprint.pose, f = this.fire.pose;
    const a = this.ads.pose, r = this.reload.pose, w = this.swap.pose, m = this.melee.pose;

    // Anchor bottom-right; ADS pulls toward center.
    const x = W * 0.74 + (b.bobX || 0) + (s.sprintX || 0) + (f.fireX || 0) + (a.adsX || 0);
    const y = H - 96 + (b.bobY || 0) + (s.sprintY || 0) + (a.adsY || 0)
      + (r.y || 0) + (w.y || 0);
    const rot = (b.bobRot || 0) + (s.sprintRot || 0) + (f.fireRot || 0)
      + (a.adsRot || 0) + (r.rot || 0) + (w.rot || 0);

    ctx.save();

    if (this.melee.active) {
      GunRenderer.drawKnife(ctx, { x: x + (m.kx || 0), y: y + (m.ky || 0), rot: m.krot || 0 });
      HandRenderer.hand(ctx, x + (m.kx || 0) - 12, y + (m.ky || 0) + 4, 9, m.krot || 0);
      ctx.restore();
      return;
    }

    const weapon = this.swap.weaponToShow(game.weapons.current);
    if (!weapon) { ctx.restore(); return; }

    const pose = {
      x, y, rot, scale: 1.9,
      magDetached: (r.magDetached || 0) > 0.5,
      magHidden: (r.magHidden || 0) > 0.5,
      magOffsetY: r.magY || 0,
      magOffsetRot: r.magRot || 0,
      boltOpen: (r.boltOpen || 0) > 0.5,
    };
    GunRenderer.draw(ctx, weapon, pose);
    HandRenderer.draw(ctx, {
      x, y, rot, scale: 1.9,
      leadHidden: (r.leadHidden || 0) > 0.5,
      leadX: r.leadX || 0,
      leadY: r.leadY || 0,
    });

    ctx.restore();
  }
}
