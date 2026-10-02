;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Pauses a running game when its page is hidden or its window loses focus.
   * Never resumes on its own; the player resumes with the game's usual controls.
   *
   *   SZ.GameAutoPause.attach({
   *     isRunning: () => state === STATE_PLAYING,
   *     pause: togglePause
   *   });
   */
  function attach(options) {
    const isRunning = options.isRunning;
    const pause = options.pause;

    function pauseIfRunning() {
      if (isRunning())
        pause();
    }

    function onVisibilityChange() {
      if (document.hidden)
        pauseIfRunning();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', pauseIfRunning);

    return {
      detach() {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('blur', pauseIfRunning);
      }
    };
  }

  SZ.GameAutoPause = { attach };
})();
