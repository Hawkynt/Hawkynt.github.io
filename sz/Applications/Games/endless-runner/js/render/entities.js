/* The moving cast of one frame: road-edge obstacle reflections, the beveled obstacles
   with their warning glows, coins, power-ups, the player with aura, afterimage trail,
   dust puffs and running limbs, and the speed lines. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const ctx = V.ctx;

  function reflections() {
    // Road edge reflections — faint mirrored obstacle silhouettes
    for (const obs of S.obstacles) {
      if (obs.y > C.CANVAS_H + 30 || obs.y < -80)
        continue;
      const ox = NS.rules.laneX(obs.lane);
      const ow = C.LANE_WIDTH * 0.7;
      const oh = obs.type === 'barrier-low' ? 25 : obs.type === 'barrier-high' ? 40 : 50;
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#000';
      ctx.translate(ox, obs.y + oh);
      ctx.scale(1, -0.4);
      ctx.fillRect(-ow / 2, 0, ow, oh);
      ctx.restore();
    }
  }

  function obstacles() {
    // Obstacles with beveled 3D look
    for (const obs of S.obstacles) {
      if (obs.y > C.CANVAS_H + 30 || obs.y < -80)
        continue;

      const ox = NS.rules.laneX(obs.lane);
      const ow = C.LANE_WIDTH * 0.7;
      const oh = obs.type === 'barrier-low' ? 25 : obs.type === 'barrier-high' ? 40 : 50;
      const bevel = 4;

      const baseColor = obs.type === 'barrier-low' ? '#e74c3c' :
                         obs.type === 'barrier-high' ? '#e67e22' : '#c0392b';
      const lightColor = obs.type === 'barrier-low' ? '#f08070' :
                          obs.type === 'barrier-high' ? '#f0a050' : '#e05040';
      const darkColor = obs.type === 'barrier-low' ? '#b03028' :
                         obs.type === 'barrier-high' ? '#b05a10' : '#8a1a10';

      // Warning glow for nearby obstacles
      const distToPlayer = C.LANE_Y_BOTTOM - obs.y;
      if (distToPlayer > 0 && distToPlayer < 150) {
        ctx.save();
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15 * (1 - distToPlayer / 150);
        ctx.fillStyle = 'rgba(255,0,0,0.2)';
        ctx.fillRect(ox - ow / 2 - 5, obs.y - 5, ow + 10, oh + 10);
        ctx.restore();
      }

      // Pulsing warning glow for full-block
      if (obs.type === 'full-block') {
        ctx.save();
        const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 200);
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20 * pulse;
        ctx.strokeStyle = `rgba(255,50,50,${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox - ow / 2 - 3, obs.y - 3, ow + 6, oh + 6);
        ctx.restore();
      }

      // Main body
      ctx.fillStyle = baseColor;
      ctx.fillRect(ox - ow / 2, obs.y, ow, oh);

      // Lighter top face (bevel)
      ctx.fillStyle = lightColor;
      ctx.fillRect(ox - ow / 2, obs.y, ow, bevel);

      // Darker right side face (bevel)
      ctx.fillStyle = darkColor;
      ctx.fillRect(ox + ow / 2 - bevel, obs.y + bevel, bevel, oh - bevel);

      // Darker bottom edge
      ctx.fillStyle = darkColor;
      ctx.fillRect(ox - ow / 2, obs.y + oh - bevel, ow, bevel);

      // Lighter left edge
      ctx.fillStyle = lightColor;
      ctx.fillRect(ox - ow / 2, obs.y, bevel, oh - bevel);

      // Type-specific patterns
      if (obs.type === 'barrier-low') {
        // Yellow/black chevron stripes
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox - ow / 2, obs.y, ow, oh);
        ctx.clip();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        for (let s = -ow; s < ow * 2; s += 12) {
          ctx.beginPath();
          ctx.moveTo(ox - ow / 2 + s, obs.y + oh);
          ctx.lineTo(ox - ow / 2 + s + oh, obs.y);
          ctx.stroke();
        }
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        for (let s = -ow + 6; s < ow * 2; s += 12) {
          ctx.beginPath();
          ctx.moveTo(ox - ow / 2 + s, obs.y + oh);
          ctx.lineTo(ox - ow / 2 + s + oh, obs.y);
          ctx.stroke();
        }
        ctx.restore();
      } else if (obs.type === 'barrier-high') {
        // Red/white horizontal stripes
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox - ow / 2, obs.y, ow, oh);
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let sy = 0; sy < oh; sy += 10)
          ctx.fillRect(ox - ow / 2, obs.y + sy, ow, 5);
        ctx.restore();
      }

      // Bolt/rivet details at corners
      ctx.fillStyle = '#333';
      const rivetR = 2.5;
      const rivetInset = 5;
      const corners = [
        [ox - ow / 2 + rivetInset, obs.y + rivetInset],
        [ox + ow / 2 - rivetInset, obs.y + rivetInset],
        [ox - ow / 2 + rivetInset, obs.y + oh - rivetInset],
        [ox + ow / 2 - rivetInset, obs.y + oh - rivetInset]
      ];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, rivetR, 0, Math.PI * 2);
        ctx.fill();
      }
      // Rivet highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx - 0.5, cy - 0.5, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function coins() {
    // Coins
    for (const coin of S.coins) {
      if (coin.collected || coin.y > C.CANVAS_H + 20 || coin.y < -30)
        continue;

      const cx = NS.rules.laneX(coin.lane);

      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(cx, coin.y, C.COIN_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Coin sparkle shimmer
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 150 + coin.y);
      ctx.beginPath();
      ctx.arc(cx - C.COIN_RADIUS * 0.3, coin.y - C.COIN_RADIUS * 0.3, C.COIN_RADIUS * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function powerUps() {
    // Power-ups
    for (const pu of S.powerUps) {
      if (pu.collected || pu.y > C.CANVAS_H + 20 || pu.y < -30)
        continue;

      const pux = NS.rules.laneX(pu.lane);
      const color = pu.type === 'magnet' ? '#ff00ff' :
                    pu.type === 'shield' ? '#00bfff' : '#ff4500';

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pux, pu.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Icon letter
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = pu.type === 'magnet' ? 'M' : pu.type === 'shield' ? 'S' : '2x';
      ctx.fillText(label, pux, pu.y);
    }
  }

  function player() {
    // Player
    const px = NS.rules.getPlayerX();
    const py = NS.rules.getPlayerY();
    const ph = NS.rules.getPlayerHeight();

    // Power-up aura / shimmer / bubble
    if (S.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#00bfff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00bfff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(px, py - ph / 2, C.PLAYER_W * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (S.magnetTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 200);
      ctx.beginPath();
      ctx.arc(px, py - ph / 2, C.MAGNET_RANGE * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (S.multiplierTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,69,0,0.15)';
      ctx.shadowColor = '#ff4500';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py - ph / 2, C.PLAYER_W * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Running afterimage trail (2-3 semi-transparent copies behind player)
    if (S.state === C.STATE_RUNNING && !S.isSliding) {
      const trailCount = 3;
      for (let ti = trailCount; ti >= 1; --ti) {
        ctx.save();
        ctx.globalAlpha = 0.08 * (trailCount - ti + 1);
        ctx.fillStyle = '#4ec0ca';
        const trailOff = ti * 6;
        // Simplified trail silhouette
        ctx.beginPath();
        ctx.arc(px, py - ph + 8 + trailOff, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(px - 8, py - ph + 16 + trailOff, 16, ph - 24);
        ctx.restore();
      }
    }

    // Dust puffs when grounded and running
    if (S.dustPuffs.length > 0) {
      ctx.save();
      for (const dp of S.dustPuffs) {
        ctx.globalAlpha = dp.alpha;
        ctx.fillStyle = '#c8b88a';
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, dp.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Player body
    ctx.save();
    ctx.fillStyle = '#4ec0ca';
    ctx.shadowColor = '#4ec0ca';
    ctx.shadowBlur = 6;

    if (S.isSliding) {
      // Sliding — low rounded rectangle
      const slideW = C.PLAYER_W + 4;
      const slideH = ph;
      const slideX = px - slideW / 2;
      const slideY = py - ph;
      const sr = 4;
      ctx.beginPath();
      ctx.moveTo(slideX + sr, slideY);
      ctx.lineTo(slideX + slideW - sr, slideY);
      ctx.arcTo(slideX + slideW, slideY, slideX + slideW, slideY + sr, sr);
      ctx.lineTo(slideX + slideW, slideY + slideH - sr);
      ctx.arcTo(slideX + slideW, slideY + slideH, slideX + slideW - sr, slideY + slideH, sr);
      ctx.lineTo(slideX + sr, slideY + slideH);
      ctx.arcTo(slideX, slideY + slideH, slideX, slideY + slideH - sr, sr);
      ctx.lineTo(slideX, slideY + sr);
      ctx.arcTo(slideX, slideY, slideX + sr, slideY, sr);
      ctx.fill();
      // Headband on sliding form
      ctx.fillStyle = '#e63946';
      ctx.fillRect(slideX + 2, slideY + 1, slideW - 4, 3);
    } else {
      // Head
      ctx.beginPath();
      ctx.arc(px, py - ph + 8, 8, 0, Math.PI * 2);
      ctx.fill();

      // Headband — red arc across head
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.arc(px, py - ph + 8, 8, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.lineTo(px + 8 * Math.cos(-Math.PI * 0.15), py - ph + 8 + 8 * Math.sin(-Math.PI * 0.15) - 2);
      ctx.arc(px, py - ph + 6, 8, -Math.PI * 0.15, -Math.PI * 0.85, true);
      ctx.fill();
      // Headband tail
      ctx.strokeStyle = '#e63946';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 7, py - ph + 5);
      ctx.lineTo(px + 13, py - ph + 3);
      ctx.lineTo(px + 11, py - ph + 7);
      ctx.stroke();

      // Body — wider rounded torso
      ctx.fillStyle = '#4ec0ca';
      const torsoX = px - 8;
      const torsoY = py - ph + 16;
      const torsoW = 16;
      const torsoH = ph - 28;
      const tr = 3;
      ctx.beginPath();
      ctx.moveTo(torsoX + tr, torsoY);
      ctx.lineTo(torsoX + torsoW - tr, torsoY);
      ctx.arcTo(torsoX + torsoW, torsoY, torsoX + torsoW, torsoY + tr, tr);
      ctx.lineTo(torsoX + torsoW, torsoY + torsoH - tr);
      ctx.arcTo(torsoX + torsoW, torsoY + torsoH, torsoX + torsoW - tr, torsoY + torsoH, tr);
      ctx.lineTo(torsoX + tr, torsoY + torsoH);
      ctx.arcTo(torsoX, torsoY + torsoH, torsoX, torsoY + torsoH - tr, tr);
      ctx.lineTo(torsoX, torsoY + tr);
      ctx.arcTo(torsoX, torsoY, torsoX + tr, torsoY, tr);
      ctx.fill();

      // Legs — running animation
      const legAngle = Math.sin(Date.now() / 80) * 0.4;
      ctx.strokeStyle = '#4ec0ca';
      ctx.lineWidth = 3;
      const legStartY = py - 8;
      const leftFootX = px - 8 * Math.sin(legAngle);
      const rightFootX = px + 8 * Math.sin(legAngle);
      ctx.beginPath();
      ctx.moveTo(px, legStartY);
      ctx.lineTo(leftFootX, py);
      ctx.moveTo(px, legStartY);
      ctx.lineTo(rightFootX, py);
      ctx.stroke();

      // Shoes — small darker rectangles at leg endpoints
      ctx.fillStyle = '#2a6a6e';
      ctx.fillRect(leftFootX - 4, py - 3, 8, 4);
      ctx.fillRect(rightFootX - 4, py - 3, 8, 4);
      // Shoe sole highlight
      ctx.fillStyle = '#1a4a4e';
      ctx.fillRect(leftFootX - 4, py, 8, 1);
      ctx.fillRect(rightFootX - 4, py, 8, 1);

      // Arms
      ctx.strokeStyle = '#4ec0ca';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py - ph + 22);
      ctx.lineTo(px - 10 * Math.sin(-legAngle), py - ph + 32);
      ctx.moveTo(px, py - ph + 22);
      ctx.lineTo(px + 10 * Math.sin(-legAngle), py - ph + 32);
      ctx.stroke();

      // Hands — small circles at arm endpoints
      ctx.fillStyle = '#4ec0ca';
      ctx.beginPath();
      ctx.arc(px - 10 * Math.sin(-legAngle), py - ph + 32, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 10 * Math.sin(-legAngle), py - ph + 32, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function speedLines() {
    // Speed lines
    if (S.speedLines.length > 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      for (const sl of S.speedLines) {
        ctx.globalAlpha = sl.alpha;
        ctx.beginPath();
        ctx.moveTo(sl.x, sl.y);
        ctx.lineTo(sl.x, sl.y + sl.length);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  NS.entities.reflections = reflections;
  NS.entities.obstacles = obstacles;
  NS.entities.coins = coins;
  NS.entities.powerUps = powerUps;
  NS.entities.player = player;
  NS.entities.speedLines = speedLines;
})();
