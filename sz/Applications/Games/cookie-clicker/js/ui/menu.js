/* The desktop menu bar (New Game, Save, Prestige with its dialog, Exit, Controls,
   About), the dialog wiring, the OS window-procedure registration and the save
   on window blur. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  /* ── Menu Bar ── */
  {
    const actions = {
      new: () => NS.saveload.newGame(),
      save: () => NS.saveload.saveGame(),
      prestige: async () => {
        const chips = NS.prestige.getHeavenlyChipsFromLifetime() - S.heavenlyChips;
        document.getElementById('prestigeInfo').textContent =
          chips > 0
            ? 'Prestige now to earn ' + chips + ' heavenly chip(s). Each chip gives +1% CPS.'
            : 'You need more cookies to earn heavenly chips. Keep baking!';
        const result = await SZ.Dialog.show('prestigeBackdrop');
        if (result === 'ok' && chips > 0)
          NS.prestige.performPrestige();
      },
      exit: () => { NS.saveload.saveGame(); SZ.Dlls.User32.DestroyWindow(); },
      controls: () => SZ.Dialog.show('controlsBackdrop'),
      about: () => SZ.Dialog.show('dlg-about')
    };
    new SZ.MenuBar({ onAction: (action) => actions[action]?.() });
  }
  /* ── Dialog Wiring ── */
  SZ.Dialog.wireAll();

  /* ── OS Integration ── */
  SZ.Dlls.User32.RegisterWindowProc(function(msg) {
    if (msg === 'WM_THEMECHANGED') {
      // Theme changed — CSS handles repainting
    }
  });

  SZ.Dlls.User32.SetWindowText('Cookie Clicker');

  /* ── Save on blur ── */
  window.addEventListener('blur', NS.saveload.saveGame);
})();
