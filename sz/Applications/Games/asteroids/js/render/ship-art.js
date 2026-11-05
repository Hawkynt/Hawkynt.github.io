/* Procedural ship art facing +x, painted once per skin: four hulls (the Kestrel dart, the arrow,
   the swept wing and the 1979 vector outline) in each skin's paint with panel lines, canopy
   glass and engine bells; hit-flash silhouettes; the shield bubble; wingdrones; escape pods.
   Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const { TAU } = NS.constants;
  const K = NS.artKit;

  const HULLS = {
    /* outline points in a 48 x 48 box, nose at +x */
    dart: [[22, 0], [6, -6], [-4, -16], [-12, -17], [-8, -6], [-12, 0], [-8, 6], [-12, 17], [-4, 16], [6, 6]],
    arrow: [[23, 0], [10, -4], [-2, -8], [-14, -14], [-10, -4], [-13, 0], [-10, 4], [-14, 14], [-2, 8], [10, 4]],
    wing: [[20, 0], [8, -5], [0, -8], [-6, -20], [-14, -21], [-10, -6], [-13, 0], [-10, 6], [-14, 21], [-6, 20], [0, 8], [8, 5]],
    vector: [[18, 0], [-12, -12], [-7, -6], [-7, 6], [-12, 12]],
  };

  function skinOf(id) {
    return NS.cosmetics.find('skin', id) || NS.cosmetics.SKINS[0];
  }

  function shipSprite(skinId) {
    const sk = skinOf(skinId);
    return K.sprite('ship:' + sk.id, 52, 52, (g, w, h) => paint(g, w / 2, h / 2, sk));
  }

  function shipFlash(skinId) {
    return K.silhouette('ship:' + skinOf(skinId).id, shipSprite(skinId));
  }

  function paint(g, cx, cy, sk) {
    const pts = HULLS[sk.hull];
    const c = sk.colors;
    if (sk.hull === 'vector') {
      /* the 1979 look: bright lines, no fill */
      g.lineJoin = 'round';
      g.strokeStyle = K.rgba(c[0], 0.25);
      g.lineWidth = 5;
      K.poly(g, pts.map(p => [cx + p[0], cy + p[1]]));
      g.stroke();
      g.strokeStyle = c[0];
      g.lineWidth = 1.8;
      g.stroke();
      return;
    }
    g.lineJoin = 'round';
    /* engine bells */
    g.fillStyle = '#20242e';
    g.fillRect(cx - 15, cy - 5, 5, 3.4);
    g.fillRect(cx - 15, cy + 1.6, 5, 3.4);
    g.fillStyle = K.rgba(c[3], 0.9);
    g.fillRect(cx - 15.5, cy - 4.3, 1.6, 2);
    g.fillRect(cx - 15.5, cy + 2.3, 1.6, 2);
    /* hull */
    K.poly(g, pts.map(p => [cx + p[0], cy + p[1]]));
    const gr = g.createLinearGradient(cx, cy - 20, cx, cy + 20);
    gr.addColorStop(0, K.shade(c[0], 0.35));
    gr.addColorStop(0.45, c[0]);
    gr.addColorStop(0.55, K.shade(c[0], -0.25));
    gr.addColorStop(1, c[1]);
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = K.shade(c[1], -0.4);
    g.lineWidth = 1.3;
    g.stroke();
    /* accent stripes along the wings */
    g.save();
    K.poly(g, pts.map(p => [cx + p[0], cy + p[1]]));
    g.clip();
    g.fillStyle = c[2];
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(cx - 2, cy - 7); g.lineTo(cx - 12, cy - 17); g.lineTo(cx - 9, cy - 17); g.lineTo(cx + 1, cy - 7);
    g.moveTo(cx - 2, cy + 7); g.lineTo(cx - 12, cy + 17); g.lineTo(cx - 9, cy + 17); g.lineTo(cx + 1, cy + 7);
    g.fill();
    g.globalAlpha = 1;
    /* panel lines */
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(cx - 10, cy); g.lineTo(cx + 14, cy);
    g.moveTo(cx - 4, cy - 10); g.lineTo(cx - 4, cy + 10);
    g.stroke();
    /* top light */
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(cx - 20, cy - 22, 44, 14);
    g.restore();
    /* canopy */
    const cg = g.createLinearGradient(cx + 2, cy - 4, cx + 10, cy + 4);
    cg.addColorStop(0, '#e0f8ff');
    cg.addColorStop(0.35, K.mix(c[2], '#60c0ff', 0.5));
    cg.addColorStop(1, '#0a1a3a');
    g.fillStyle = cg;
    g.beginPath();
    g.ellipse(cx + 5, cy, 6.5, 3.2, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.ellipse(cx + 6, cy - 1.3, 2.2, 0.8, 0, 0, TAU);
    g.fill();
    /* nose light */
    g.fillStyle = c[3];
    g.beginPath();
    g.arc(cx + pts[0][0] - 2, cy, 1.2, 0, TAU);
    g.fill();
  }

  function shield() {
    return K.sprite('shield', 72, 72, (g, w) => {
      const c = w / 2;
      const gr = g.createRadialGradient(c, c, 22, c, c, 34);
      gr.addColorStop(0, 'rgba(74,184,255,0)');
      gr.addColorStop(0.7, 'rgba(74,184,255,0.22)');
      gr.addColorStop(0.92, 'rgba(200,240,255,0.85)');
      gr.addColorStop(1, 'rgba(74,184,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 1;
      for (let i = 0; i < 6; ++i) {
        const a = i * TAU / 6;
        g.beginPath();
        g.arc(c, c, 31, a, a + 0.5);
        g.stroke();
      }
    });
  }

  function drone() {
    return K.sprite('drone', 24, 24, (g, w) => {
      const c = w / 2;
      K.poly(g, [[c + 9, c], [c - 5, c - 7], [c - 2, c], [c - 5, c + 7]]);
      const gr = g.createLinearGradient(c, c - 7, c, c + 7);
      gr.addColorStop(0, '#f0e0ff');
      gr.addColorStop(1, '#5a3a8a');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = '#2a1a4a';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = '#d08aff';
      g.beginPath();
      g.arc(c + 1, c, 2, 0, TAU);
      g.fill();
    });
  }

  function pod() {
    return K.sprite('pod', 34, 34, (g, w) => {
      const c = w / 2;
      const gr = g.createRadialGradient(c - 4, c - 4, 1, c, c, 11);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.5, '#c8d8e8');
      gr.addColorStop(1, '#4a5a70');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(c, c, 11, 8, 0, 0, TAU);
      g.fill();
      g.strokeStyle = '#1a2a3a';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#6dff9a';
      g.beginPath();
      g.ellipse(c + 3, c - 1, 3.5, 2.5, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#ff5a6a';
      g.fillRect(c - 9, c - 1, 4, 2);
    });
  }

  Object.assign(NS.shipArt, {
    HULLS, shipSprite, shipFlash, shield, drone, pod, skinOf
  });
})();
