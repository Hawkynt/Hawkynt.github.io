;(function() {
  'use strict';

  /* Drawing the guests: sprites at their seats, order bubbles with the
     patience ring, dishes being eaten, goodbyes, the critic's card and the
     VIP spotlight. Reads G only. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { SEAT_Y, BUBBLE_DY, GUEST_SCALE } = NS.C;
  const { ctx, ui } = NS.view;
  const { bubbleSprite, checkSprite, patienceColor } = NS.sprites;

  function drawOrderBubble(c) {
    const f = Math.max(0, c.patience / c.patienceMax);
    /* the bubble bobs gently; an untaken order bounces to invite a click,
       an impatient one trembles */
    const shake = f < 0.25 ? Math.sin(G.animT * 40 + c.seat) * 2 : 0;
    const bob = c.ticket ? Math.sin(G.animT * 2 + c.seat) * 1.5 : -Math.abs(Math.sin(G.animT * 5 + c.seat)) * 5;
    const pop = c.bubbleT !== undefined ? Math.min(1, (G.animT - c.bubbleT) / 0.25) : 1;
    const s = pop < 1 ? 0.3 + 0.7 * (1 - Math.pow(1 - pop, 3)) + Math.sin(pop * Math.PI) * 0.15 : 1;
    const bx = c.x + shake, by = SEAT_Y - BUBBLE_DY + bob;
    ctx.save();
    ctx.translate(bx, by + 50);
    ctx.scale(s, s);
    ctx.translate(-bx, -(by + 50));
    ctx.drawImage(bubbleSprite(), bx - 48, by - 48, 96, 104);
    /* patience ring: dark track, coloured arc, a pulse when it runs low */
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(60,40,20,0.18)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(bx, by, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = patienceColor(f);
    ctx.lineWidth = f < 0.25 ? 6 + Math.sin(G.animT * 14) * 1.5 : 6;
    ctx.beginPath();
    ctx.arc(bx, by, 34, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
    SZ.FoodArt.drawDish(ctx, c.order, bx, by + 2, 64, 1, 'good');
    if (c.ticket) ctx.drawImage(checkSprite(), bx + 18, by - 44, 26, 26);
    ctx.restore();
    SZ.PeopleArt.drawMood(ctx, bx + 58, by - 18 + Math.sin(G.animT * 3 + c.seat) * 2, c.mood, 30);
  }

  function customerPose(c) {
    return c.state === 'walkIn' ? 'walk'
      : c.state === 'waiting' ? (c.mood === 'angry' ? 'angry' : c.mood === 'impatient' ? 'fret' : 'sit')
      : c.state === 'eating' ? 'eat'
      : (c.mood === 'angry' ? 'angry' : 'happy');
  }

  function drawCustomers() {
    const sorted = G.customers.slice().sort((a, b) => a.x - b.x);
    for (const c of sorted) {
      /* a little hop when the dish arrives */
      const hopY = c.hop > 0 ? -Math.sin((1 - c.hop / 0.4) * Math.PI) * 16 : 0;
      ctx.save();
      ctx.translate(c.x, SEAT_Y + hopY);
      ctx.scale(GUEST_SCALE, GUEST_SCALE);
      SZ.PeopleArt.drawCustomer(ctx, c.look, 0, 0, customerPose(c), G.animT + c.seat * 0.37, 1);
      ctx.restore();
    }
  }

  /* bubbles, moods and cards sit above the counter layer */
  function drawCustomerOverlays() {
    for (const c of G.customers) {
      if (c.state === 'waiting') drawOrderBubble(c);
      else if (c.state === 'eating') {
        SZ.FoodArt.drawDish(ctx, c.order, c.x - 4, SEAT_Y + 4, 54, 1, 'good');
      } else if (c.state === 'leaving') {
        SZ.PeopleArt.drawMood(ctx, c.x + 44, SEAT_Y - 128 - c.leaveT * 10, c.mood === 'angry' ? 'angry' : 'love', 30);
        if (c.wave > 0) drawWave(c);
        if (c.rating > 0 && c.leaveT < 1.8) drawRatingCard(c);
      }
    }
  }

  /* a small hand waving goodbye beside the head */
  function drawWave(c) {
    ctx.save();
    ctx.translate(c.x + 36, SEAT_Y - 92);
    ctx.rotate(Math.sin(G.animT * 12) * 0.5);
    ctx.fillStyle = c.look.skin;
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 1.5;
    ui.roundRectPath(-5, -13, 10, 17, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* the critic holds up the score card for a moment before vanishing */
  function drawRatingCard(c) {
    const rx = c.x, ry = SEAT_Y - 186;
    ctx.save();
    if (c.leaveT > 1.4) ctx.globalAlpha = (1.8 - c.leaveT) / 0.4;
    const k = Math.min(1, c.leaveT / 0.2);
    ctx.translate(rx, ry);
    ctx.scale(0.5 + 0.5 * k, 0.5 + 0.5 * k);
    ui.drawPanel(-62, -20, 124, 40, { style: 'paper', radius: 6, accent: '#c04cff' });
    for (let i = 0; i < 5; ++i)
      ui.drawStar(-44 + i * 22, 2, 20, i < c.rating);
    ctx.restore();
  }

  /* a VIP walks in under a golden spotlight */
  function drawCarpet() {
    if (!G.carpet) return;
    const k = G.carpet.t / 1.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, k * 2) * 0.8;
    ui.drawGlow(G.carpet.x, SEAT_Y - 60, 260, '#ffd890', 12);
    ctx.restore();
  }

  NS.guestsView = { drawCustomers, drawCustomerOverlays, drawCarpet };

})();
