'use strict';

/* Save files: the career exported to an encrypted, signed file and read back; a file with a
   flipped byte, a file re-encrypted with an edited career, and an edited career re-signed with
   another key are all refused; an import takes over the career, a reset starts a fresh one; the
   Save Data screen with its two-click reset. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const F = NS.saveFile;

(async () => {
  check('this platform can encrypt files', F.available());
  G.save.credits = 123457;
  G.save.licenses.push('amber');
  const json = NS.save.snapshot();
  const file = await F.exportSave(json);
  check('the export is a Space Mining save file', file.indexOf(F.MAGIC) === 0);
  check('nothing of the career can be read in it', file.indexOf('123457') < 0 && Buffer.from(file.slice(F.MAGIC.length), 'base64').toString().indexOf('123457') < 0);
  const back = await F.importSave(file);
  check('it reads back to exactly the career that went in', back === json);
  check('two exports of the same career differ (a fresh key per file)', (await F.exportSave(json)) !== file);

  /* a flipped byte */
  const box = JSON.parse(Buffer.from(file.slice(F.MAGIC.length), 'base64').toString());
  const c = Buffer.from(box.c, 'base64');
  c[20] ^= 1;
  const flipped = F.MAGIC + Buffer.from(JSON.stringify(Object.assign({}, box, { c: c.toString('base64') }))).toString('base64');
  let why = '';
  try { await F.importSave(flipped); } catch (e) { why = e.message; }
  check('a file with a flipped byte is refused', /damaged or was changed/.test(why), why);
  why = '';
  try { await F.importSave('{"credits":999999999}'); } catch (e) { why = e.message; }
  check('a plain edited save is refused', /Not a Space Mining save file/.test(why));

  /* an edited career, signed with another key and encrypted for the game (its public key is public) */
  const S = crypto.subtle;
  const edited = JSON.stringify(Object.assign(JSON.parse(json), { credits: 999999999 }));
  const mallory = await S.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const sig = Buffer.from(await S.sign({ name: 'ECDSA', hash: 'SHA-256' }, mallory.privateKey, new TextEncoder().encode(edited))).toString('base64');
  const plain = JSON.stringify({ s: edited, g: sig });
  const gamePub = { kty: 'EC', crv: 'P-256', x: 'jdbZOcwfD8yDJvutr4QnvSFFV-Hx257KfWpGQxHPxTg', y: 'MtsD05J7wXZP-WzZOKLaEQ7Ud5PXNT0523l-k9Yp1Rc', ext: true };
  const eph = await S.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const game = await S.importKey('jwk', gamePub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await S.deriveBits({ name: 'ECDH', public: game }, eph.privateKey, 256);
  const hk = await S.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const key = await S.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('sz-space-mining-save'), info: new TextEncoder().encode('v1') }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await S.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(plain));
  const forged = F.MAGIC + Buffer.from(JSON.stringify({ e: Buffer.from(await S.exportKey('raw', eph.publicKey)).toString('base64'), iv: Buffer.from(iv).toString('base64'), c: Buffer.from(ct).toString('base64') })).toString('base64');
  why = '';
  try { await F.importSave(forged); } catch (e) { why = e.message; }
  check('an edited career re-signed with another key is refused', /was changed/.test(why), why);

  /* adopting and resetting */
  G.save.credits = 5;
  await NS.saveUi.load(file);
  check('importing a file takes over the career', G.save.credits === 123457 && G.save.licenses.indexOf('amber') >= 0);
  check('and writes it to storage', JSON.parse(env.store[NS.save.SAVE_KEY]).credits === 123457);
  NS.saveUi.open();
  check('the title opens the Save Data screen', G.screen === 'savedata');
  NS.frame.draw();
  check('with export, import, reset and back', ['sd_export', 'sd_import', 'sd_reset', 'sd_back'].every(id => G.hitAreas.some(a => a.id === id)));
  NS.saveUi.doReset();
  check('one click on reset only arms it', G.save.credits === 123457);
  NS.saveUi.doReset();
  check('the second click starts a fresh career', G.save.credits !== 123457 && G.save.licenses.length === 1 && JSON.parse(env.store[NS.save.SAVE_KEY]).licenses.length === 1);
  done();
})();
