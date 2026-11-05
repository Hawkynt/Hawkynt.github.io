/* Boss art, painted once per frame and cached at 160 x 160: King Gnarl the crowned mole,
   Rimefang the yeti golem, Clinker the furnace crab, the MB-9 mecha bomber and Baron Blackfuse.
   Also white hit-flash silhouettes for any cached sprite. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const K = NS.artKit;
  const TAU = Math.PI * 2;
  const S = 160;

  function sprite(type, f) {
    return K.sprite('boss:' + type + ':' + f, S, S, (x) => {
      (PAINT[type] || PAINT.mole)(x, f);
    });
  }

  /* The same sprite filled with one colour (hit flash) */
  function silhouette(key, src, color) {
    return K.sprite('sil:' + key + ':' + color, src.width, src.height, (x) => {
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = color;
      x.fillRect(0, 0, src.width, src.height);
    });
  }

  function eye(x, cx, cy, r, look, color) {
    K.circle(x, cx, cy, r, '#ffffff');
    K.circle(x, cx + look, cy + 1, r * 0.55, color || '#1a1020');
    K.circle(x, cx + look + r * 0.2, cy - r * 0.2, r * 0.18, '#ffffff');
  }

  const PAINT = {
    mole(x, f) {
      const up = f ? -6 : 0;
      K.ellipse(x, 80, 146, 54, 10, 'rgba(0,0,0,0.3)');
      K.ball(x, 80, 96, 50, '#8a5a3a');
      K.ellipse(x, 80, 112, 30, 26, '#c89a7a');
      /* claws */
      for (const s of [-1, 1]) {
        K.ball(x, 80 + s * 50, 104 + up * s, 17, '#e8c8b0');
        x.fillStyle = '#f8f0e8';
        for (let i = 0; i < 3; ++i) { x.beginPath(); x.moveTo(80 + s * (56 + i * 5), 112 + up * s); x.lineTo(80 + s * (62 + i * 6), 128 + up * s); x.lineTo(80 + s * (52 + i * 6), 116 + up * s); x.fill(); }
      }
      K.ball(x, 80, 84, 11, '#ff8aa0');
      x.strokeStyle = '#1a1020'; x.lineWidth = 4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(56, 66); x.lineTo(68, 70); x.moveTo(104, 66); x.lineTo(92, 70); x.stroke();
      x.fillStyle = '#ffd84a';
      x.beginPath(); x.moveTo(52, 50); x.lineTo(52, 26); x.lineTo(66, 40); x.lineTo(80, 18); x.lineTo(94, 40); x.lineTo(108, 26); x.lineTo(108, 50); x.closePath(); x.fill();
      x.strokeStyle = '#b08a20'; x.lineWidth = 2; x.stroke();
      K.circle(x, 80, 38, 5, '#4fe08a'); K.circle(x, 62, 44, 3, '#ff4f7a'); K.circle(x, 98, 44, 3, '#4fd0ff');
      x.fillStyle = '#ffffff'; x.fillRect(74, 96, 5, 7); x.fillRect(81, 96, 5, 7);
    },
    yeti(x, f) {
      const up = f ? -5 : 0;
      K.ellipse(x, 80, 148, 58, 10, 'rgba(0,0,0,0.3)');
      for (let i = 0; i < 14; ++i) {
        const a = i / 14 * TAU;
        K.ball(x, 80 + Math.cos(a) * 42, 96 + Math.sin(a) * 40, 18, i % 2 ? '#f4fbff' : '#dfeef8');
      }
      K.ball(x, 80, 96, 44, '#f4fbff');
      for (const s of [-1, 1]) {
        K.ball(x, 80 + s * 56, 110 + up * s, 20, '#e4f2fc');
        K.ball(x, 80 + s * 60, 128 + up * s, 13, '#8ab8d8');
        x.fillStyle = '#c8e4f4';
        x.beginPath(); x.moveTo(80 + s * 26, 54); x.quadraticCurveTo(80 + s * 46, 28, 80 + s * 40, 10); x.quadraticCurveTo(80 + s * 34, 34, 80 + s * 16, 50); x.fill();
      }
      x.fillStyle = '#6aa8d8'; K.roundRect(x, 52, 70, 56, 46, 20); x.fill();
      eye(x, 68, 86, 8, 2, '#0a2a4a'); eye(x, 92, 86, 8, 2, '#0a2a4a');
      x.strokeStyle = '#0a2a4a'; x.lineWidth = 4;
      x.beginPath(); x.moveTo(58, 74); x.lineTo(76, 80); x.moveTo(102, 74); x.lineTo(84, 80); x.stroke();
      x.fillStyle = '#0a2a4a'; K.roundRect(x, 64, 100, 32, 10, 4); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(68, 100); x.lineTo(72, 108); x.lineTo(76, 100); x.moveTo(84, 100); x.lineTo(88, 108); x.lineTo(92, 100); x.fill();
    },
    crab(x, f) {
      const up = f ? -6 : 0;
      K.ellipse(x, 80, 146, 64, 10, 'rgba(0,0,0,0.3)');
      x.strokeStyle = '#b04a1a'; x.lineWidth = 6;
      for (const s of [-1, 1]) for (let i = 0; i < 3; ++i) { x.beginPath(); x.moveTo(80 + s * 30, 112 + i * 6); x.lineTo(80 + s * (56 + i * 6), 128 + i * 4 + (f ^ (i & 1)) * 3); x.stroke(); }
      x.fillStyle = '#4a4a52'; x.fillRect(66, 26, 28, 40);
      x.fillStyle = '#2a2a30'; x.fillRect(62, 22, 36, 8);
      const gl = x.createRadialGradient(80, 22, 2, 80, 22, 26);
      gl.addColorStop(0, 'rgba(255,220,120,0.9)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
      x.fillStyle = gl; x.fillRect(50, 0, 60, 40);
      const g = x.createRadialGradient(68, 86, 8, 80, 100, 60);
      g.addColorStop(0, '#ffb070'); g.addColorStop(0.6, '#ff6a2a'); g.addColorStop(1, '#a8320a');
      x.fillStyle = g; x.beginPath(); x.ellipse(80, 100, 56, 34, 0, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,220,120,0.8)';
      for (let i = 0; i < 4; ++i) x.fillRect(58 + i * 12, 96, 6, 12);
      for (const s of [-1, 1]) {
        x.save(); x.translate(80 + s * 62, 74 + up * s); x.rotate(s * -0.3);
        K.ball(x, 0, 0, 20, '#ff6a2a');
        x.fillStyle = '#ff8a4a'; x.beginPath(); x.moveTo(-6 * s, -6); x.lineTo(s * 24, -22); x.lineTo(s * 8, 2); x.fill();
        x.restore();
        x.strokeStyle = '#a8320a'; x.lineWidth = 4; x.beginPath(); x.moveTo(80 + s * 14, 72); x.lineTo(80 + s * 18, 52); x.stroke();
        eye(x, 80 + s * 18, 48, 8, -s, '#1a1020');
      }
    },
    mecha(x, f) {
      K.ellipse(x, 80, 148, 50, 9, 'rgba(0,0,0,0.3)');
      const fl = x.createLinearGradient(0, 128, 0, 156);
      fl.addColorStop(0, '#ffffff'); fl.addColorStop(0.4, '#7ef9ff'); fl.addColorStop(1, 'rgba(126,249,255,0)');
      x.fillStyle = fl;
      x.beginPath(); x.moveTo(52, 128); x.lineTo(60, 156 + f * 4); x.lineTo(68, 128); x.moveTo(92, 128); x.lineTo(100, 156 + f * 4); x.lineTo(108, 128); x.fill();
      x.fillStyle = '#5a6470'; K.roundRect(x, 46, 118, 28, 14, 4); x.fill(); K.roundRect(x, 86, 118, 28, 14, 4); x.fill();
      const g = x.createLinearGradient(0, 60, 0, 124);
      g.addColorStop(0, '#c8d4e0'); g.addColorStop(1, '#6a7888');
      x.fillStyle = g; K.roundRect(x, 36, 62, 88, 62, 14); x.fill();
      x.fillStyle = '#2a3440'; K.roundRect(x, 50, 86, 60, 26, 6); x.fill();
      for (let i = 0; i < 5; ++i) { x.fillStyle = i === (f * 2) % 5 ? '#ff4f7a' : '#4ff0ff'; x.fillRect(56 + i * 10, 96, 6, 6); }
      K.ball(x, 80, 46, 30, '#a8b8c8');
      x.fillStyle = '#1a2430'; K.roundRect(x, 56, 36, 48, 18, 9); x.fill();
      x.fillStyle = '#7ef9ff'; K.roundRect(x, 62, 40, 36, 10, 5); x.fill();
      x.fillStyle = '#ffffff'; x.fillRect(66, 42, 8, 3);
      x.strokeStyle = '#5a6470'; x.lineWidth = 3; x.beginPath(); x.moveTo(80, 16); x.lineTo(80, 2); x.stroke();
      K.circle(x, 80, 2, 5, f ? '#ff4f7a' : '#ffd84a');
      x.fillStyle = '#5a6470'; K.roundRect(x, 12, 70, 26, 36, 8); x.fill(); K.roundRect(x, 122, 70, 26, 36, 8); x.fill();
      K.ball(x, 25, 112, 12, '#2a2d3a'); K.ball(x, 135, 112, 12, '#2a2d3a');
      K.circle(x, 25, 98, 3, '#ffd23a'); K.circle(x, 135, 98, 3, '#ffd23a');
    },
    baron(x, f) {
      K.ellipse(x, 80, 148, 48, 9, 'rgba(0,0,0,0.3)');
      const cape = x.createLinearGradient(0, 50, 0, 150);
      cape.addColorStop(0, '#4a1a7a'); cape.addColorStop(1, '#1a0a2a');
      x.fillStyle = cape;
      x.beginPath(); x.moveTo(80, 50); x.lineTo(30 - f * 4, 146); x.quadraticCurveTo(80, 134, 130 + f * 4, 146); x.closePath(); x.fill();
      x.fillStyle = '#c58bff'; x.beginPath(); x.moveTo(80, 56); x.lineTo(46, 146); x.lineTo(58, 146); x.closePath(); x.fill();
      x.fillStyle = '#2a1a3a'; K.roundRect(x, 60, 70, 40, 64, 10); x.fill();
      x.fillStyle = '#ffd84a'; for (let i = 0; i < 3; ++i) K.circle(x, 80, 82 + i * 14, 3, '#ffd84a');
      K.ball(x, 80, 54, 22, '#e8dcf0');
      x.fillStyle = '#1a0a2a'; x.fillRect(48, 30, 64, 6); x.fillRect(58, -2, 44, 34);
      x.fillStyle = '#c58bff'; x.fillRect(58, 22, 44, 6);
      eye(x, 72, 52, 5, 1, '#6a1aaa');
      K.circle(x, 90, 52, 7, 'rgba(200,230,255,0.4)'); x.strokeStyle = '#ffd84a'; x.lineWidth = 2; x.beginPath(); x.arc(90, 52, 7, 0, TAU); x.stroke();
      K.circle(x, 90, 53, 3, '#6a1aaa');
      x.strokeStyle = '#1a0a2a'; x.lineWidth = 4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(68, 64); x.quadraticCurveTo(80, 60, 92, 64); x.moveTo(80, 62); x.quadraticCurveTo(66, 72, 62, 64); x.moveTo(80, 62); x.quadraticCurveTo(94, 72, 98, 64); x.stroke();
      x.strokeStyle = '#3a2a1a'; x.lineWidth = 5; x.beginPath(); x.moveTo(122, 140); x.lineTo(118 - f * 2, 70); x.stroke();
      K.ball(x, 118 - f * 2, 66, 9, '#2a2d3a');
      x.strokeStyle = '#c89a5a'; x.lineWidth = 2; x.beginPath(); x.moveTo(120, 58); x.quadraticCurveTo(126, 48, 130, 50); x.stroke();
      K.circle(x, 131, 49, 4, f ? '#ffffff' : '#ffd23a');
    }
  };

  Object.assign(NS.bossArt, {
    S, sprite, silhouette, PAINT
  });
})();
