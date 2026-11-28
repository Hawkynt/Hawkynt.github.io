/* Note art, painted once per skin, lane colour and kind into 64 px sprites: the fifteen skins (orb,
   classic bar, lane arrow, diamond, star, heart, vinyl, pixel, prism and the festival snowflake,
   petal, sunburst, maple leaf, pumpkin and sparkler), the star-phrase gold rim, the dark Hush note
   with its mute mark (the same in every skin, so it always reads), the receptors at the hit line
   (idle and pressed, with their key) and the pickup badges. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const K = NS.artKit;
  const { TAU } = C;

  const S = 64;

  function gloss(g, r) {
    const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.75)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    return gr;
  }

  function shapePath(g, shape, lane) {
    switch (shape) {
      case 'bar': K.roundRect(g, -26, -11, 52, 22, 9); return;
      case 'arrow': {
        g.save(); g.rotate([Math.PI / 2, 0, Math.PI, -Math.PI / 2][lane % 4] + Math.PI);
        g.beginPath(); g.moveTo(0, -22); g.lineTo(20, 0); g.lineTo(9, 0); g.lineTo(9, 20); g.lineTo(-9, 20); g.lineTo(-9, 0); g.lineTo(-20, 0); g.closePath();
        g.restore(); return;
      }
      case 'diamond': g.beginPath(); g.moveTo(0, -22); g.lineTo(22, 0); g.lineTo(0, 22); g.lineTo(-22, 0); g.closePath(); return;
      case 'star': case 'spark': K.star(g, 0, 0, 23, shape === 'spark' ? 0.32 : 0.48, shape === 'spark' ? 8 : 5); return;
      case 'heart': g.beginPath(); g.moveTo(0, 19); g.bezierCurveTo(-30, 0, -14, -24, 0, -9); g.bezierCurveTo(14, -24, 30, 0, 0, 19); g.closePath(); return;
      case 'pixel': g.beginPath(); for (const [x, y] of [[-12, -20], [-20, -12], [-20, 12], [-12, 20], [12, 20], [20, 12], [20, -12], [12, -20]]) g.lineTo(x, y); g.closePath(); return;
      case 'prism': g.beginPath(); for (let i = 0; i < 6; ++i) { const a = i / 6 * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); } g.closePath(); return;
      case 'snow': K.star(g, 0, 0, 22, 0.55, 6); return;
      case 'petal': g.beginPath(); for (let i = 0; i < 5; ++i) { const a = i / 5 * TAU - Math.PI / 2; g.ellipse(Math.cos(a) * 9, Math.sin(a) * 9, 12, 8, a, 0, TAU); } return;
      case 'sun': K.star(g, 0, 0, 23, 0.7, 12); return;
      case 'leaf': g.beginPath(); g.moveTo(0, -22); g.lineTo(7, -9); g.lineTo(20, -12); g.lineTo(14, 2); g.lineTo(21, 10); g.lineTo(6, 10); g.lineTo(0, 22); g.lineTo(-6, 10); g.lineTo(-21, 10); g.lineTo(-14, 2); g.lineTo(-20, -12); g.lineTo(-7, -9); g.closePath(); return;
      case 'pumpkin': g.beginPath(); g.ellipse(-9, 3, 12, 17, 0, 0, TAU); g.ellipse(9, 3, 12, 17, 0, 0, TAU); g.ellipse(0, 3, 12, 18, 0, 0, TAU); return;
      default: g.beginPath(); g.arc(0, 0, 21, 0, TAU);
    }
  }

  /* kind: tap, star, hush */
  function note(shape, lane, kind) {
    const color = C.LANE_COLORS[lane % 4];
    return K.sprite('note:' + shape + ':' + lane + ':' + kind, S, S, (g) => {
      g.translate(S / 2, S / 2);
      if (kind === 'hush') {
        const gr = g.createRadialGradient(0, 0, 4, 0, 0, 24);
        gr.addColorStop(0, '#3a2a5a'); gr.addColorStop(0.7, '#120a20'); gr.addColorStop(1, '#000000');
        g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fillStyle = gr; g.fill();
        g.lineWidth = 3; g.strokeStyle = '#b89aff'; g.stroke();
        g.strokeStyle = '#e0d0ff'; g.lineWidth = 3.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-8, -8); g.lineTo(8, 8); g.moveTo(8, -8); g.lineTo(-8, 8); g.stroke();
        return;
      }
      /* glow halo */
      const halo = g.createRadialGradient(0, 0, 10, 0, 0, 31);
      halo.addColorStop(0, K.rgba(kind === 'star' ? '#ffd25a' : color, 0.55));
      halo.addColorStop(1, K.rgba(color, 0));
      g.fillStyle = halo;
      g.fillRect(-32, -32, 64, 64);
      if (shape === 'vinyl') {
        K.circle(g, 0, 0, 21, '#111018');
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
        for (const rr of [17, 13.5, 10]) { g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke(); }
        K.circle(g, 0, 0, 7.5, color);
        K.circle(g, 0, 0, 1.8, '#000');
      } else {
        shapePath(g, shape, lane);
        const fill = shape === 'prism' ? (() => { const q = g.createLinearGradient(-22, -22, 22, 22); ['#ff5a8a', '#ffd25a', '#7bff6a', '#5af0ff', '#c48aff'].forEach((c, i) => q.addColorStop(i / 4, c)); return q; })() : color;
        g.fillStyle = fill;
        g.fill();
        g.lineWidth = 2.5;
        g.strokeStyle = K.shade(color, -0.45);
        g.stroke();
        if (shape === 'pixel') { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-12, -12, 8, 8); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, 4, 8, 8); }
        else { g.fillStyle = gloss(g, 22); shapePath(g, shape, lane); g.fill(); }
        if (shape === 'pumpkin') { g.fillStyle = '#3a6a1a'; g.fillRect(-2, -20, 4, 7); }
      }
      if (kind === 'star') {
        g.lineWidth = 3.5;
        g.strokeStyle = '#ffd25a';
        g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.stroke();
        g.fillStyle = '#fff6c0';
        K.star(g, 0, 0, 8, 0.45, 5);
        g.fill();
      }
    });
  }

  /* the hold body's colour strip (stretched along the lane) */
  function holdBody(lane, star) {
    const color = star ? '#ffd25a' : C.LANE_COLORS[lane % 4];
    return K.sprite('hold:' + lane + ':' + (star ? 1 : 0), 32, 8, (g) => {
      const gr = g.createLinearGradient(0, 0, 32, 0);
      gr.addColorStop(0, K.rgba(color, 0.15));
      gr.addColorStop(0.3, K.rgba(color, 0.85));
      gr.addColorStop(0.5, K.rgba('#ffffff', 0.9));
      gr.addColorStop(0.7, K.rgba(color, 0.85));
      gr.addColorStop(1, K.rgba(color, 0.15));
      g.fillStyle = gr;
      g.fillRect(0, 0, 32, 8);
    });
  }

  function receptor(lane, pressed) {
    const color = C.LANE_COLORS[lane];
    return K.sprite('rec:' + lane + ':' + (pressed ? 1 : 0), 96, 96, (g) => {
      g.translate(48, 48);
      if (pressed) {
        const gr = g.createRadialGradient(0, 0, 6, 0, 0, 46);
        gr.addColorStop(0, K.rgba('#ffffff', 0.9)); gr.addColorStop(0.35, K.rgba(color, 0.7)); gr.addColorStop(1, K.rgba(color, 0));
        g.fillStyle = gr; g.fillRect(-48, -48, 96, 96);
      }
      g.lineWidth = 4;
      g.strokeStyle = pressed ? '#ffffff' : color;
      g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = K.rgba(color, 0.6);
      g.beginPath(); g.arc(0, 0, 33, 0, TAU); g.stroke();
      g.fillStyle = K.rgba(color, pressed ? 0.5 : 0.18);
      g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.fill();
      g.font = 'bold 18px ' + C.UI.font;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = pressed ? '#ffffff' : K.rgba('#ffffff', 0.75);
      g.fillText(C.KEY_LABELS[lane], 0, 1);
    });
  }

  const PICK_ICON = { shield: 'shield', heart: 'heart', magnet: 'magnet', mult: 'star' };
  function pickup(kind) {
    return K.sprite('pick:' + kind, 30, 30, (g) => {
      g.translate(15, 15);
      K.circle(g, 0, 0, 13, '#ffffff');
      K.circle(g, 0, 0, 11, '#1a1030');
      g.drawImage(NS.kit.iconSprite(PICK_ICON[kind], 16, kind === 'heart' ? '#ff5a7a' : kind === 'mult' ? '#ffd25a' : '#5af0ff'), -10, -10);
    });
  }

  Object.assign(NS.notesArt, { note, holdBody, receptor, pickup, shapePath });
})();
