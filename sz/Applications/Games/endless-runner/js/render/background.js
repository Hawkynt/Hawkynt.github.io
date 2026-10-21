/* The backdrop of one frame: the tier sky gradient with the screen shake applied, the
   parallax city skyline, and the ground, grass, road, noise, lane markings, edges and
   guardrails. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const ctx = V.ctx;

  function sky(tier) {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    skyGrad.addColorStop(0, tier.skyTop);
    skyGrad.addColorStop(1, tier.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Apply screen shake
    V.screenShake.apply(ctx);
  }

  function skyline(tier) {
    // City skyline silhouette (parallax layer behind everything)
    {
      ctx.save();
      const skylineY = C.CANVAS_H - 100;
      const buildings = [
        { w: 30, h: 60 }, { w: 20, h: 90 }, { w: 40, h: 50 }, { w: 25, h: 75 },
        { w: 35, h: 110 }, { w: 18, h: 45 }, { w: 28, h: 80 }, { w: 22, h: 55 },
        { w: 38, h: 95 }, { w: 15, h: 40 }, { w: 32, h: 70 }, { w: 26, h: 85 },
        { w: 20, h: 60 }, { w: 34, h: 100 }, { w: 24, h: 65 }
      ];
      // Compute total tile width for seamless wrapping
      const GAP = 6;
      let tileWidth = 0;
      for (const b of buildings)
        tileWidth += b.w + GAP;

      const buildingColor = tier.name === 'neon' ? 'rgba(30,10,60,0.7)' :
                       tier.name === 'night' ? 'rgba(10,10,30,0.6)' :
                       tier.name === 'sunset' ? 'rgba(60,20,10,0.4)' : 'rgba(80,80,120,0.25)';
      ctx.fillStyle = buildingColor;
      const wrappedOffset = S.skylineOffset % tileWidth;
      let bx = -wrappedOffset;
      for (let i = 0; bx < C.CANVAS_W + 50; ++i) {
        const b = buildings[i % buildings.length];
        ctx.fillRect(bx, skylineY - b.h, b.w, b.h);
        // Window dots on taller buildings
        if (b.h > 50 && (tier.name === 'night' || tier.name === 'neon')) {
          ctx.fillStyle = 'rgba(255,255,150,0.4)';
          for (let wy = skylineY - b.h + 8; wy < skylineY - 5; wy += 12)
            for (let wx = bx + 4; wx < bx + b.w - 4; wx += 8)
              ctx.fillRect(wx, wy, 3, 4);
          ctx.fillStyle = buildingColor;
        }
        bx += b.w + GAP;
      }
      ctx.restore();
    }
  }

  function groundRoad(tier) {
    // Ground
    ctx.fillStyle = tier.ground;
    ctx.fillRect(0, C.CANVAS_H - 100, C.CANVAS_W, 100);

    // Grass blades along road edges
    {
      const roadLeft = (C.CANVAS_W - C.NUM_LANES * C.LANE_WIDTH) / 2;
      const roadW = C.NUM_LANES * C.LANE_WIDTH;
      const grassY = C.CANVAS_H - 100;
      ctx.save();
      ctx.fillStyle = tier.name === 'neon' ? '#0f3f0f' :
                       tier.name === 'night' ? '#1a4a1a' :
                       tier.name === 'sunset' ? '#6a8a3a' : '#3a7a3a';
      // Left side grass
      for (let gx = roadLeft - 30; gx < roadLeft + 4; gx += 5) {
        const gh = 6 + Math.sin(gx * 0.7 + S.roadOffset * 0.1) * 3;
        ctx.beginPath();
        ctx.moveTo(gx - 2, grassY);
        ctx.lineTo(gx, grassY - gh);
        ctx.lineTo(gx + 2, grassY);
        ctx.fill();
      }
      // Right side grass
      for (let gx = roadLeft + roadW - 4; gx < roadLeft + roadW + 30; gx += 5) {
        const gh = 6 + Math.sin(gx * 0.7 + S.roadOffset * 0.1) * 3;
        ctx.beginPath();
        ctx.moveTo(gx - 2, grassY);
        ctx.lineTo(gx, grassY - gh);
        ctx.lineTo(gx + 2, grassY);
        ctx.fill();
      }
      ctx.restore();
    }

    // Road
    const roadLeft = (C.CANVAS_W - C.NUM_LANES * C.LANE_WIDTH) / 2;
    const roadW = C.NUM_LANES * C.LANE_WIDTH;
    ctx.fillStyle = tier.road;
    ctx.fillRect(roadLeft, 0, roadW, C.CANVAS_H);

    // Road noise texture — subtle speckle dots
    {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      // Use a seeded-ish pattern based on position so it doesn't flicker
      for (let ny = 0; ny < C.CANVAS_H; ny += 6)
        for (let nx = roadLeft + 3; nx < roadLeft + roadW - 3; nx += 7) {
          const hash = (nx * 31 + ny * 17 + Math.floor(S.roadOffset) * 3) & 0xff;
          if (hash < 40)
            ctx.fillRect(nx + (hash % 5), ny + (hash % 4), 1, 1);
        }
      ctx.restore();
    }

    // Lane dividers
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    ctx.lineDashOffset = -S.roadOffset;
    for (let i = 1; i < C.NUM_LANES; ++i) {
      const x = roadLeft + i * C.LANE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, C.CANVAS_H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Road edges
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(roadLeft, 0);
    ctx.lineTo(roadLeft, C.CANVAS_H);
    ctx.moveTo(roadLeft + roadW, 0);
    ctx.lineTo(roadLeft + roadW, C.CANVAS_H);
    ctx.stroke();

    // Guardrail posts along road edges
    {
      ctx.save();
      ctx.fillStyle = '#888';
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      const postSpacing = 80;
      const postOffset = S.roadOffset % postSpacing;
      for (let py = postOffset - postSpacing; py < C.CANVAS_H; py += postSpacing) {
        // Left guardrail post
        ctx.fillRect(roadLeft - 6, py, 4, 12);
        ctx.strokeRect(roadLeft - 6, py, 4, 12);
        // Right guardrail post
        ctx.fillRect(roadLeft + roadW + 2, py, 4, 12);
        ctx.strokeRect(roadLeft + roadW + 2, py, 4, 12);
      }
      // Guardrail rails (horizontal bars between posts)
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(roadLeft - 5, 0);
      ctx.lineTo(roadLeft - 5, C.CANVAS_H);
      ctx.moveTo(roadLeft + roadW + 3, 0);
      ctx.lineTo(roadLeft + roadW + 3, C.CANVAS_H);
      ctx.stroke();
      ctx.restore();
    }
  }

  NS.background.sky = sky;
  NS.background.skyline = skyline;
  NS.background.groundRoad = groundRoad;
})();
