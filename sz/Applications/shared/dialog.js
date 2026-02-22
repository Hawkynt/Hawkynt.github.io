;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  const Dialog = {

    show(dialogId) {
      const overlay = document.getElementById(dialogId);
      if (!overlay) return Promise.resolve(null);

      overlay.classList.add('visible');

      return new Promise((resolve) => {
        function onClick(e) {
          const btn = e.target.closest('[data-result]');
          if (!btn) return;
          overlay.classList.remove('visible');
          overlay.removeEventListener('click', onClick);
          resolve(btn.dataset.result);
        }
        overlay.addEventListener('click', onClick);
      });
    },

    close(dialogId) {
      const overlay = document.getElementById(dialogId);
      if (overlay)
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
