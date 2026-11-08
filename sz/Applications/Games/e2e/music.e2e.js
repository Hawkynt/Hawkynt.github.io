'use strict';

/* The shared soundtrack engine in a real browser: every style rendered offline through the real
   Web Audio graph (synths, drums, sidechain, section filter, compressor) at a steady intensity -
   none clips, none is silent, all sit at a similar loudness next to a plain song - and each is
   saved as a WAV beside the screenshots for listening. Hosted in the Tetris page. */
const fs = require('fs');
const os = require('os');
const path = require('path');
exports.ns = 'Tetris';
exports.game = 'tetris';

exports.run = async (t) => {
  await t.open();
  const out = path.join(process.argv.indexOf('--out') >= 0 ? path.resolve(process.argv[process.argv.indexOf('--out') + 1]) : path.join(os.tmpdir(), 'sz-e2e'), 'music');
  fs.mkdirSync(out, { recursive: true });
  const styles = await t.run(() => Object.keys(W.SZ.GameMusic.STYLES));
  const seconds = Number(process.env.SZ_MUSIC_SECONDS || 40);
  const levels = {};
  for (const id of styles.concat(['plain'])) {
    await t.page.eval('window.__mus = null');
    await t.run((NS, G, id, seconds) => {
      const M = W.SZ.GameMusic;
      const song = id === 'plain' ? NS.music.REALM[0] : { id: 'e2e-' + id, style: id, root: 50, scale: id === 'chip' || id === 'funk' || id === 'epic' ? 'major' : 'minor', prog: id === 'chip' || id === 'funk' || id === 'epic' ? [0, 4, 5, 3] : [0, 5, 6, 4], seed: 21 };
      M.render(song, seconds, 0.7).then((r) => {
        const d = r.buffer.getChannelData(0), e = r.buffer.getChannelData(1), n = d.length;
        const bytes = new Uint8Array(44 + n * 2);
        const v = new DataView(bytes.buffer);
        const s = (o, str) => { for (let i = 0; i < str.length; ++i) bytes[o + i] = str.charCodeAt(i); };
        s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, r.buffer.sampleRate, true); v.setUint32(28, r.buffer.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; ++i) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, (d[i] + e[i]) / 2)) * 32767, true);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
        window.top.__mus = { id: id, peak: r.peak, rms: r.rms, wav: btoa(bin) };
      });
    }, id, seconds);
    let r = null;
    for (let k = 0; k < 1200 && !(r && r.id === id); ++k) { await t.wait(250); r = await t.page.eval('window.__mus'); }
    if (r && r.id !== id) r = null;
    if (!r) { t.check(id + ' renders', false); continue; }
    fs.writeFileSync(path.join(out, id + '.wav'), Buffer.from(r.wav, 'base64'));
    levels[id] = r;
    console.log('  ' + id.padEnd(10) + ' peak ' + r.peak.toFixed(3) + '  rms ' + r.rms.toFixed(4));
  }
  const ref = levels.plain ? levels.plain.rms : 0.05;
  for (const id of styles) {
    const r = levels[id];
    if (!r) continue;
    t.check(id + ' does not clip', r.peak < 0.99, r.peak);
    t.check(id + ' sits near the plain songs\' loudness', r.rms > ref * 0.5 && r.rms < ref * 2.2, { rms: r.rms, plain: ref });
  }
};
