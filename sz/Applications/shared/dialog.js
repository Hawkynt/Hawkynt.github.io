;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  const Dialog = {

    show(dialogId) {
      const overlay = document.getElementById(dialogId);
      if (!overlay) return Promise.resolve(null);

      overlay.classList.add('visible');

      return new Promise((resolve) => {
        function done(result) {
          overlay.classList.remove('visible');
          overlay.removeEventListener('click', onClick);
          document.removeEventListener('keydown', onKey);
          delete overlay._dialogDone;
          resolve(result);
        }
        function onClick(e) {
          const btn = e.target.closest('[data-result]');
          if (btn)
            done(btn.dataset.result);
        }
        function onKey(e) {
          if (e.key !== 'Enter')
            return;
          if (!overlay.classList.contains('visible'))
            return;
          const btn = overlay.querySelector('[data-default][data-result]')
            || overlay.querySelector('[data-result]');
          if (!btn)
            return;
          e.preventDefault();
          done(btn.dataset.result);
        }
        overlay._dialogDone = done;
        overlay.addEventListener('click', onClick);
        document.addEventListener('keydown', onKey);
      });
    },

    close(dialogId) {
      const overlay = document.getElementById(dialogId);
      if (!overlay)
        return;
      if (overlay._dialogDone)
        overlay._dialogDone(null);
      else
        overlay.classList.remove('visible');
    },

    wireAll() {
      for (const overlay of document.querySelectorAll('.dialog-overlay'))
        overlay.addEventListener('click', function(e) {
          if (e.target.closest('[data-result]'))
            this.classList.remove('visible');
        });
    },

  };

  SZ.Dialog = Dialog;
})();
