/* The Save Data screen, opened from the title: export the career to an encrypted, signed file
   (downloaded as .smsave), import one - from this browser or another - after checking its
   signature, or reset the career (a second click within a few seconds confirms). Shows what
   happened and why an import was refused. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const W = NS.widgets;

  const ui = { msg: '', color: UI.text, armT: 0, busy: false };

  function open() {
    ui.msg = '';
    ui.armT = 0;
    NS.screens.setScreen('savedata');
  }

  function say(text, color) {
    ui.msg = text;
    ui.color = color || UI.text;
  }

  /* the career to a file the browser downloads */
  async function doExport() {
    if (ui.busy) return;
    ui.busy = true;
    try {
      const text = await NS.saveFile.exportSave(NS.save.snapshot());
      const day = new Date().toISOString().slice(0, 10);
      download('space-mining-' + day + '.smsave', text);
      say('Exported - keep the file; import it here or in another browser', UI.good);
    } catch (e) {
      say(e.message || 'Export failed', UI.bad);
    }
    ui.busy = false;
  }

  function download(name, text) {
    if (typeof document === 'undefined' || !document.body || typeof Blob === 'undefined') return;
    const a = document.createElement('a');
    if (!a.click) return;
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); if (a.remove) a.remove(); }, 1000);
  }

  /* a file picked by the player: checked, then it replaces the career */
  function doImport() {
    if (ui.busy || typeof document === 'undefined') return;
    const input = document.createElement('input');
    if (!input.click) return;
    input.type = 'file';
    input.accept = '.smsave,text/plain';
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => load(String(r.result));
      r.readAsText(f);
    };
    input.click();
  }

  async function load(text) {
    ui.busy = true;
    try {
      const json = await NS.saveFile.importSave(text);
      NS.save.adopt(JSON.parse(json));
      say('Imported - welcome back, pilot', UI.good);
    } catch (e) {
      say(e.message || 'Import failed', UI.bad);
    }
    ui.busy = false;
  }

  function doReset() {
    if (ui.armT > 0) {
      ui.armT = 0;
      NS.save.reset();
      say('The career was reset - a fresh start at Kessler Station', UI.warn);
      return;
    }
    ui.armT = 4;
    say('Click Reset again to wipe the career - this cannot be undone', UI.bad);
  }

  function draw() {
    if (ui.armT > 0) ui.armT = Math.max(0, ui.armT - 1 / 60);
    const save = G.save;
    const x = 340, y = 150, w = 600, h = 420;
    kit.panel(x, y, w, h, { accent: UI.accent, glow: true });
    kit.text('SAVE DATA', x + 30, y + 40, 26, '#ffffff', { weight: 'bold' });
    kit.text(kit.group(save.credits) + ' credits  -  ' + save.licenses.length + ' of 5 belts  -  ' + (save.stats.trips || 0) + ' trips', x + 30, y + 72, 13, UI.textDim);
    const ok = NS.saveFile.available();
    W.button('sd_export', 'Export to a file', x + 30, y + 110, 260, 46, { icon: 'cargo', accent: UI.good, disabled: !ok || ui.busy, action: doExport });
    kit.wrap('An encrypted, signed file - load it in another browser or keep it safe. An edited file is refused.', x + 310, y + 122, 260, 12, 16, UI.textDim);
    W.button('sd_import', 'Import a file', x + 30, y + 176, 260, 46, { icon: 'launch', accent: UI.accent, disabled: !ok || ui.busy, action: doImport });
    kit.wrap('Replaces this career with the one in the file.', x + 310, y + 192, 260, 12, 16, UI.textDim);
    W.button('sd_reset', ui.armT > 0 ? 'Click again to reset' : 'Reset the career', x + 30, y + 242, 260, 46, { icon: 'demolish', accent: UI.bad, action: doReset });
    kit.wrap('Wipes everything and starts over at Kessler Station.', x + 310, y + 258, 260, 12, 16, UI.textDim);
    if (!ok) say('This browser cannot encrypt files (it needs a secure https page)', UI.bad);
    if (ui.msg) kit.wrap(ui.msg, x + 30, y + 320, w - 60, 14, 19, ui.color);
    W.button('sd_back', 'Back', x + w - 160, y + h - 64, 130, 40, { icon: 'back', action: () => NS.screens.setScreen('title') });
  }

  Object.assign(NS.saveUi, {
    open, draw, load, doExport, doImport, doReset
  });
})();
