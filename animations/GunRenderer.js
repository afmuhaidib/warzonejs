// animations/GunRenderer.js — Draws the viewmodel weapon (side profile) with a
// full transform: position, rotation, scale. All shapes are procedural per
// weapon shortName; attachments (silencer, optics, extended mag) change the
// silhouette. The magazine can be drawn detached (reload) at its own transform.
// Pure draw module. Dependencies: reads weapon config only.

export class GunRenderer {
  /**
   * @param {object} pose {x, y, rot, scale, magOffsetX/Y/Rot?, magDetached?, boltOpen?}
   * Origin is the grip; weapon points +x.
   */
  static draw(ctx, weapon, pose) {
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.rot || 0);
    const s = pose.scale || 1;
    ctx.scale(s, s);

    const kind = weapon ? weapon.shortName : 'AR';
    const dark = '#1b1d16';
    const mid = '#2b2e24';
    const metal = '#3a3d35';

    // --- body per weapon type ---
    if (kind === 'SG') {
      ctx.fillStyle = mid;
      ctx.fillRect(-26, -7, 64, 12);                   // receiver
      ctx.fillStyle = '#4a3a21';
      ctx.fillRect(-44, -5, 20, 9);                    // wood stock
      ctx.fillStyle = metal;
      ctx.fillRect(38, -5, 46, 7);                     // barrel
      ctx.fillStyle = dark;
      ctx.fillRect(20, 1, 30, 6);                      // pump
    } else if (kind === 'SNP') {
      ctx.fillStyle = mid;
      ctx.fillRect(-30, -6, 70, 11);
      ctx.fillStyle = dark;
      ctx.fillRect(-48, -4, 20, 12);                   // stock
      ctx.fillStyle = metal;
      ctx.fillRect(40, -4, 64, 5);                     // long barrel
      ctx.fillStyle = dark;                            // scope (always)
      ctx.fillRect(-6, -16, 34, 8);
      ctx.beginPath(); ctx.arc(-6, -12, 5, 0, Math.PI * 2); ctx.fill();
      if (pose.boltOpen) { ctx.fillStyle = '#888'; ctx.fillRect(8, -10, 4, 8); }
    } else { // AR
      ctx.fillStyle = mid;
      ctx.fillRect(-24, -7, 58, 12);
      ctx.fillStyle = dark;
      ctx.fillRect(-42, -5, 20, 10);                   // stock
      ctx.fillStyle = metal;
      ctx.fillRect(34, -4, 36, 6);                     // barrel
      ctx.fillStyle = dark;
      ctx.fillRect(0, -12, 16, 5);                     // carry handle / rail
    }

    // --- attachments ---
    if (weapon && weapon.silenced) {
      ctx.fillStyle = dark;
      const bx = kind === 'SNP' ? 104 : kind === 'SG' ? 84 : 70;
      ctx.fillRect(bx, -6, 22, 9);
    }
    if (weapon && weapon.optic === 'reddot' && kind !== 'SNP') {
      ctx.fillStyle = dark;
      ctx.fillRect(4, -15, 12, 8);
      ctx.fillStyle = '#e04f33';
      ctx.fillRect(9, -12, 2, 2);
    }
    if (weapon && weapon.optic === 'acog' && kind !== 'SNP') {
      ctx.fillStyle = dark;
      ctx.fillRect(0, -17, 22, 10);
      ctx.beginPath(); ctx.arc(0, -12, 5, 0, Math.PI * 2); ctx.fill();
    }

    // --- magazine (attached or mid-reload detached) ---
    if (kind !== 'SG') {
      const magH = weapon && weapon.extendedMag ? 24 : 16;
      ctx.save();
      if (pose.magDetached) {
        ctx.translate(pose.magOffsetX || 0, pose.magOffsetY || 0);
        ctx.rotate(pose.magOffsetRot || 0);
      }
      if (!pose.magHidden) {
        ctx.fillStyle = dark;
        ctx.fillRect(8, 5, 10, magH);
        ctx.fillStyle = '#555a4c';
        ctx.fillRect(8, 5 + magH - 3, 10, 3);
      }
      ctx.restore();
    }

    // Grip + trigger guard.
    ctx.fillStyle = dark;
    ctx.fillRect(-6, 5, 9, 14);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  /** Knife for the melee animation. */
  static drawKnife(ctx, pose) {
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.rot || 0);
    ctx.fillStyle = '#1b1d16';
    ctx.fillRect(-14, -3, 16, 7);                      // handle
    ctx.fillStyle = '#b9c0bb';
    ctx.beginPath();                                   // blade
    ctx.moveTo(2, -4); ctx.lineTo(34, -2); ctx.lineTo(38, 1); ctx.lineTo(2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
