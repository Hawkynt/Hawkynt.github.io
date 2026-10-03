;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Pauses a running game when the browser tab is hidden (switched away or
   * minimized). Losing focus does not pause: clicking the desktop, its title
   * bar or another window keeps the game running, as in a real desktop.
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

    return {
      detach() {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }

  SZ.GameAutoPause = { attach };
})();
