/* The room scene: the floor with its warp distortion and perspective-transition
   transform, every interactive object drawn by type, the portals/doors, the player wisp
   and the title-screen door art. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const ctx = NS.dom.ctx;
  const ROOMS = NS.rooms;
  const { UI, shade, withAlpha, roundRectPath, glowCircle, drawStone, drawFloor, drawDoor, drawWisp } = NS.primitives;

  function drawRoom() {
    const def = ROOMS[S.currentRoom];
    const t = performance.now() / 1000;

    drawFloor(def);

    // Warp distortion overlay
    if (S.warpActive) {
      const time = performance.now() / 200;
      for (let y = 0; y < C.canvasH; y += 4) {
        const offset = Math.sin(y * 0.05 + time) * S.waveAmplitude * S.warpEffect;
        ctx.save();
        ctx.translate(offset, 0);
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = def.accentColor;
        ctx.fillRect(0, y, C.canvasW, 4);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Perspective transition visual
    if (S.transitionProgress < 1) {
      ctx.save();
      const scale = 0.8 + 0.2 * S.transitionProgress;
      const rotation = (1 - S.transitionProgress) * Math.PI * 0.1;
      ctx.translate(C.canvasW / 2, C.canvasH / 2);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.translate(-C.canvasW / 2, -C.canvasH / 2);
    }

    // Objects
    for (const obj of def.objects) {
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      switch (obj.type) {
        case 'clue': {
          // Floating rune stone with a question mark
          const bob = Math.sin(t * 2.2 + obj.x) * 3;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(cx, obj.y + obj.h + 4, 9, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          glowCircle(cx, cy + bob, 26, 'rgba(255,230,120,0.35)', 'rgba(255,230,120,0)');
          ctx.save();
          ctx.translate(cx, cy + bob);
          ctx.rotate(Math.PI / 4);
          const g = ctx.createLinearGradient(-10, -10, 10, 10);
          g.addColorStop(0, '#fff6c0');
          g.addColorStop(1, '#e0a92a');
          ctx.fillStyle = g;
          ctx.fillRect(-10, -10, 20, 20);
          ctx.strokeStyle = 'rgba(120,70,0,0.6)';
          ctx.strokeRect(-10, -10, 20, 20);
          ctx.restore();
          ctx.fillStyle = '#6a3d00';
          ctx.font = 'bold 14px ' + UI.font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', cx, cy + bob + 1);
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
          break;
        }
        case 'platform':
          drawStone(obj.x, obj.y, obj.w, obj.h, shade(def.accentColor, -0.45));
          break;
        case 'stairPlatform': {
          drawStone(obj.x, obj.y, obj.w, obj.h, shade(def.accentColor, -0.5));
          // Step notches that seem to climb forever
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          for (let sx = obj.x + 6; sx < obj.x + obj.w - 10; sx += 24)
            ctx.fillRect(sx, obj.y + 4 + ((sx - obj.x) / 24 % 4), 14, 3);
          break;
        }
        case 'wall':
          drawStone(obj.x, obj.y, obj.w, obj.h, shade(def.accentColor, -0.55));
          break;
        case 'colorTile': {
          const c = obj.tileColor || '#888';
          ctx.save();
          ctx.shadowColor = c;
          ctx.shadowBlur = 10 + Math.sin(t * 3 + obj.x) * 4;
          roundRectPath(obj.x + 2, obj.y + 2, obj.w - 4, obj.h - 4, 6);
          const g = ctx.createLinearGradient(obj.x, obj.y, obj.x + obj.w, obj.y + obj.h);
          g.addColorStop(0, shade(c, 0.35));
          g.addColorStop(1, shade(c, -0.25));
          ctx.fillStyle = g;
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          roundRectPath(obj.x + 6, obj.y + 5, obj.w - 12, 6, 3);
          ctx.fill();
          break;
        }
        case 'shadow': {
          glowCircle(cx, cy, obj.w, 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
          ctx.fillStyle = 'rgba(160,180,200,0.5)';
          ctx.beginPath();
          ctx.arc(cx - 5, cy - 2, 1.6, 0, Math.PI * 2);
          ctx.arc(cx + 5, cy - 2, 1.6, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'fracture': {
          // Jagged glowing crack; its shape shifts a few times per second
          const seed = Math.floor(t * 6);
          ctx.save();
          ctx.shadowColor = '#ff3040';
          ctx.shadowBlur = 14;
          for (const [w, col] of [[6, 'rgba(255,60,80,0.35)'], [2, '#ffd0d0']]) {
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(obj.x + obj.w / 2, obj.y);
            for (let fy = obj.y + 10, i = 0; fy <= obj.y + obj.h; fy += 10, ++i) {
              const n = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
              ctx.lineTo(obj.x + obj.w / 2 + (n - Math.floor(n) - 0.5) * 12, fy);
            }
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'phantomBridge': {
          const a = 0.3 + Math.sin(t * 2) * 0.2;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fillStyle = def.accentColor;
          for (let px = obj.x; px < obj.x + obj.w; px += 18)
            ctx.fillRect(px, obj.y, 14, obj.h);
          ctx.globalAlpha = a * 0.6;
          ctx.fillRect(obj.x, obj.y - 3, obj.w, 2);
          ctx.fillRect(obj.x, obj.y + obj.h + 1, obj.w, 2);
          ctx.restore();
          break;
        }
        case 'nexusOrb': {
          glowCircle(cx, cy, obj.w * 1.6, 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)');
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 2; ++i) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, obj.w * 0.95, obj.w * 0.35, t * (i ? -1.1 : 0.8) + i, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          glowCircle(cx, cy, obj.w / 2, '#ffffff', '#b8c4ff');
          break;
        }
        case 'echo':
          drawWisp(cx, cy, '#00ccff', 0.35 + Math.sin(t * 3) * 0.15, { x: Math.sin(t), y: 0 });
          break;
        case 'goal': {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(t * 0.4);
          ctx.fillStyle = 'rgba(255,215,0,0.35)';
          for (let i = 0; i < 12; ++i) {
            ctx.rotate(Math.PI / 6);
            ctx.beginPath();
            ctx.moveTo(-3, obj.w * 0.55);
            ctx.lineTo(0, obj.w * 1.15);
            ctx.lineTo(3, obj.w * 0.55);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
          ctx.save();
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 20;
          glowCircle(cx, cy, obj.w / 2, '#fffbe0', '#ffb300');
          ctx.restore();
          break;
        }
      }
    }

    // Portals / Doors
    if (def.portals)
      for (const p of def.portals)
        drawDoor(p, def.accentColor, t);

    if (S.transitionProgress < 1)
      ctx.restore();
  }

  function drawPlayer() {
    const dir = { x: 0, y: 0 };
    if (S.keys['ArrowLeft'] || S.keys['KeyA']) dir.x = -1;
    if (S.keys['ArrowRight'] || S.keys['KeyD']) dir.x = 1;
    if (S.keys['ArrowUp'] || S.keys['KeyW']) dir.y = -1;
    if (S.keys['ArrowDown'] || S.keys['KeyS']) dir.y = 1;
    drawWisp(S.player.x, S.player.y, '#3cc8ff', 1, dir);
  }

  /* Title art: a door standing alone, opening onto another room */
  function drawTitleArt(cx, cy, t) {
    // Floor ellipse
    glowCircle(cx, cy + 62, 120, 'rgba(120,140,255,0.25)', 'rgba(120,140,255,0)');
    ctx.strokeStyle = 'rgba(160,170,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; ++i) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 62, 40 * i, 9 * i, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawDoor({ x: cx - 30, y: cy - 50, w: 60, h: 110 }, '#9d7bff', t);
    // Stairs drifting through the doorway
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 4; ++i)
      ctx.fillRect(cx - 18 + i * 7, cy + 40 - i * 12, 14, 4);
    drawWisp(cx - 70, cy + 52 + Math.sin(t * 2) * 3, '#3cc8ff', 1, { x: 1, y: 0 });
  }

  Object.assign(NS.scene, { drawRoom, drawPlayer, drawTitleArt });
})();
