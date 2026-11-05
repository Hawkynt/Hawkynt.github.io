/* Item art, painted once and cached: bombs in every bomb skin (with the Mega Bomb), fire
   (centre bursts and horizontal/vertical arms at three intensities), power-up tiles with their
   icons, gems, big gems, seasonal tokens, the hearts and drop shadows. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const { TILE } = NS.constants;
  const { BOMB_SKINS } = NS.meta;
  const { POWERUP_BY_ID } = NS.content;
  const K = NS.artKit;
  const I = NS.icons;
  const T = TILE;
  const TAU = Math.PI * 2;

  function bombSkin(id) {
    for (let i = 0; i < BOMB_SKINS.length; ++i) if (BOMB_SKINS[i].id === id) return BOMB_SKINS[i];
    return BOMB_SKINS[0];
  }

  /* A bomb 56 x 60, body centred at (28, 34); mega bombs are red and studded */
  function bomb(skinId, mega, enemy) {
    const key = 'bomb:' + skinId + ':' + (mega ? 1 : 0) + ':' + (enemy || '');
    return K.sprite(key, 56, 60, (x) => {
      const s = enemy === 'e' ? { body: '#4a1a5a', shine: '#b06ad0', band: '#2a0a3a' } : enemy === 'b' ? { body: '#5a1a1a', shine: '#d06a6a', band: '#3a0a0a', spikes: true } : bombSkin(skinId);
      const body = mega ? '#b0201a' : s.body;
      if (s.spikes || mega) {
        x.fillStyle = mega ? '#ffd84a' : s.band;
        for (let i = 0; i < 8; ++i) {
          const a = i * TAU / 8;
          x.beginPath(); x.moveTo(28 + Math.cos(a) * 24, 34 + Math.sin(a) * 24);
          x.lineTo(28 + Math.cos(a + 0.25) * 16, 34 + Math.sin(a + 0.25) * 16); x.lineTo(28 + Math.cos(a - 0.25) * 16, 34 + Math.sin(a - 0.25) * 16); x.fill();
        }
      }
      K.ball(x, 28, 34, mega ? 21 : 18, body);
      x.fillStyle = s.band;
      x.fillRect(22, 11, 12, 7);
      if (s.stripes) {
        x.strokeStyle = s.band; x.lineWidth = 3;
        x.beginPath(); x.moveTo(12, 30); x.lineTo(20, 25); x.lineTo(28, 30); x.lineTo(36, 25); x.lineTo(44, 30); x.stroke();
        x.strokeStyle = '#ffd84a'; x.beginPath(); x.moveTo(11, 40); x.lineTo(45, 40); x.stroke();
      }
      if (s.ribbon) {
        x.fillStyle = s.band; x.fillRect(25, 16, 6, 36); x.fillRect(10, 31, 36, 6);
      }
      if (s.face === 'skull') {
        K.circle(x, 22, 32, 4, '#2a2a2a'); K.circle(x, 34, 32, 4, '#2a2a2a');
        x.fillStyle = '#2a2a2a'; x.fillRect(22, 42, 12, 3);
      } else if (s.face === 'jack') {
        x.fillStyle = '#3a1a00';
        x.beginPath(); x.moveTo(18, 32); x.lineTo(24, 26); x.lineTo(26, 33); x.fill();
        x.beginPath(); x.moveTo(38, 32); x.lineTo(32, 26); x.lineTo(30, 33); x.fill();
        x.beginPath(); x.moveTo(18, 40); x.lineTo(38, 40); x.lineTo(34, 46); x.lineTo(22, 46); x.fill();
      }
      x.fillStyle = K.rgba(s.shine, 0.85);
      x.beginPath(); x.ellipse(21, 27, 5, 3, -0.6, 0, TAU); x.fill();
      x.strokeStyle = '#c89a5a'; x.lineWidth = 3; x.lineCap = 'round';
      x.beginPath(); x.moveTo(28, 12); x.quadraticCurveTo(32, 3, 40, 5); x.stroke();
    });
  }

  /* Fire pieces: kind 'c' centre, 'h' horizontal arm, 'v' vertical arm; level 0..2 thickness */
  function fire(kind, level) {
    return K.sprite('fire:' + kind + ':' + level, T, T, (x) => {
      const k = [1, 0.78, 0.55][level];
      const layers = [['#ff4a1a', 0.5], ['#ff9a2a', 0.38], ['#ffe066', 0.26], ['#ffffff', 0.12]];
      for (let i = 0; i < layers.length; ++i) {
        const w = T * layers[i][1] * 2 * k;
        x.fillStyle = layers[i][0];
        if (kind === 'h') { K.roundRect(x, 0, T / 2 - w / 2, T, w, w / 2); x.fill(); }
        else if (kind === 'v') { K.roundRect(x, T / 2 - w / 2, 0, w, T, w / 2); x.fill(); }
        else { x.beginPath(); x.arc(T / 2, T / 2, w * 0.62, 0, TAU); x.fill(); }
      }
    });
  }

  function shadow(w) {
    return K.sprite('shadow:' + w, w, w * 0.4, (x) => {
      const g = x.createRadialGradient(w / 2, w * 0.2, 1, w / 2, w * 0.2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.save(); x.scale(1, 0.4); x.fillRect(0, 0, w, w); x.restore();
      x.fillRect(0, 0, 0, 0);
    });
  }

  /* A power-up tile: rounded glossy panel in the power-up colour with its icon */
  function powerup(id) {
    return K.sprite('pu:' + id, 44, 44, (x) => {
      const def = POWERUP_BY_ID[id];
      const c = def ? def.color : '#ffffff';
      x.fillStyle = K.shade(c, -0.55); K.roundRect(x, 1, 3, 42, 40, 9); x.fill();
      const g = x.createLinearGradient(0, 0, 0, 40);
      g.addColorStop(0, K.shade(c, 0.35)); g.addColorStop(1, K.shade(c, -0.2));
      x.fillStyle = g; K.roundRect(x, 1, 1, 42, 38, 9); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.35)'; K.roundRect(x, 4, 3, 36, 12, 6); x.fill();
      x.fillStyle = 'rgba(20,10,20,0.55)'; K.roundRect(x, 6, 6, 32, 30, 7); x.fill();
      x.drawImage(I.get(id === 'skull' ? 'skull' : id, id === 'bomb' ? '#ff5d5d' : c, 60), 7, 6, 30, 30);
    });
  }

  function gem(big) {
    return K.sprite('gem:' + (big ? 1 : 0), 32, 32, (x) => {
      x.drawImage(I.get('gem', big ? '#c070ff' : '#4ff0ff', 64), 0, 0, 32, 32);
    });
  }

  function token(seasonId) {
    const icon = { winter: 'snowflake', spring: 'egg', summer: 'shell', autumn: 'pumpkin', yearend: 'gift' }[seasonId] || 'star';
    const color = { winter: '#e8f8ff', spring: '#ffb8e0', summer: '#ffd0b0', autumn: '#ff8a1a', yearend: '#ff5da0' }[seasonId] || '#ffd84a';
    return K.sprite('token:' + seasonId, 36, 36, (x) => {
      x.drawImage(K.glow(color), -10, -10, 56, 56);
      x.drawImage(I.get(icon, color, 64), 4, 4, 28, 28);
    });
  }

  function warm() {
    for (let i = 0; i < BOMB_SKINS.length; ++i) bomb(BOMB_SKINS[i].id, false);
    bomb('classic', true); bomb('classic', false, 'e'); bomb('classic', false, 'b');
    for (const k of ['c', 'h', 'v']) for (let l = 0; l < 3; ++l) fire(k, l);
    for (const id in POWERUP_BY_ID) powerup(id);
    gem(false); gem(true); shadow(40);
  }

  Object.assign(NS.itemArt, {
    bombSkin, bomb, fire, shadow, powerup, gem, token, warm
  });
})();
