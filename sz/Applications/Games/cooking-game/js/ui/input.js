;(function() {
  'use strict';

  /* Input mapping: pointer clicks on the play view, menu and tree clicks,
     the keyboard per screen and the auto-pause hook. Writes the mouse
     fields of G and triggers the systems; wired once by attachInput. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { STATE_TITLE, STATE_UPGRADES, STATE_HELP, STATE_PLAYING, STATE_PAUSED, STATE_DAY_OVER,
    SEAT_Y, STATION_Y, STATION_W, STATION_H, BUBBLE_DY, BELL, HELP_PAGES } = NS.C;
  const { TREE_BRANCH_LIST } = NS.Tree;
  const { canvas, pointerToView } = NS.view;
  const { sfx } = NS.juice;
  const { treeLevel, buyNode } = NS.persist;
  const { stationX, isMenuState } = NS.rules;
  const { endCoach } = NS.coach;
  const { takeOrder } = NS.customers;
  const { clickStation, activateRush } = NS.stations;
  const { clickPass, clickTrash } = NS.serving;
  const { pauseDay, resumeDay } = NS.day;
  const { setScreen, openHelp, moveMenuCursor, activateMenuItem } = NS.menu;
  const { buildTreeLayout, celebrateBuy, treeCardById, selectFirstInBranch, moveTreeSelection } = NS.treeScreen;

  function handleCanvasClick(mx, my) {
    if (G.state !== STATE_PLAYING) return;

    if (G.coachSkip && mx >= G.coachSkip.x && mx <= G.coachSkip.x + G.coachSkip.w && my >= G.coachSkip.y && my <= G.coachSkip.y + G.coachSkip.h) {
      endCoach();
      sfx('click');
      return;
    }

    if (treeLevel('p_rush') > 0 && Math.hypot(mx - BELL.x, my - BELL.y) <= BELL.r + 8) {
      activateRush();
      return;
    }
    if (clickPass(mx, my)) return;
    if (clickTrash(mx, my)) return;

    for (const c of G.customers) {
      if (c.state !== 'waiting') continue;
      const by = SEAT_Y - BUBBLE_DY;
      if (Math.hypot(mx - c.x, my - by) < 36 ||
          (Math.abs(mx - c.x) < 46 && my > SEAT_Y - 120 && my < SEAT_Y + 6)) {
        takeOrder(c);
        return;
      }
    }

    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i) {
      if (mx >= stationX(i) && mx <= stationX(i) + STATION_W && my >= STATION_Y && my <= STATION_Y + STATION_H) {
        clickStation(i);
        return;
      }
    }
  }

  /* Pointer, focus and keyboard input; wired once at boot. */
  function attachInput() {
    canvas.addEventListener('pointerdown', (e) => {
      /* the frame must keep keyboard focus after clicks */
      window.focus();

      const p = pointerToView(e);
      G.mouseX = p.x;
      G.mouseY = p.y;
      G.mouseDown = true;

      if (G.state === STATE_UPGRADES) {
        if (!G.treeLayout) G.treeLayout = buildTreeLayout();
        for (const tab of G.treeLayout.tabs) {
          if (G.mouseX >= tab.x && G.mouseX <= tab.x + tab.w && G.mouseY >= tab.y && G.mouseY <= tab.y + tab.h) {
            G.treeBranch = tab.index;
            selectFirstInBranch();
            sfx('click', { volume: 0.4 });
            return;
          }
        }
        for (const card of G.treeLayout.cards) {
          if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h) {
            G.treeSelected = card.node.id;
            if (buyNode(card.node.id)) {
              G.treeBuyFlash = { id: card.node.id, at: G.animT };
              celebrateBuy(card);
            }
            return;
          }
        }
        return;
      }

      if (isMenuState(G.state) || G.state === STATE_PAUSED || G.state === STATE_DAY_OVER) {
        for (let i = 0; i < G.hitAreas.length; ++i) {
          const a = G.hitAreas[i];
          if (G.mouseX >= a.x && G.mouseX <= a.x + a.w && G.mouseY >= a.y && G.mouseY <= a.y + a.h) {
            G.menuCursor = i;
            activateMenuItem(a);
            return;
          }
        }
        return;
      }

      handleCanvasClick(p.x, p.y);
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = pointerToView(e);
      G.mouseX = p.x;
      G.mouseY = p.y;
    });

    canvas.addEventListener('pointerleave', () => {
      G.mouseX = -1;
      G.mouseY = -1;
      G.mouseDown = false;
    });

    canvas.addEventListener('pointerup', () => { G.mouseDown = false; });

    /* ── keyboard ── */

    /* Pause when the window is hidden or loses focus */
    SZ.GameAutoPause.attach({
      isRunning: () => G.state === STATE_PLAYING,
      pause: pauseDay
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setScreen(STATE_TITLE);
        return;
      }

      /* ── Kitchen upgrade tree navigation ── */
      if (G.state === STATE_UPGRADES) {
        e.preventDefault();
        if (e.key === 'Escape') {
          setScreen(G.prevScreen);
        } else if (e.key === 'Tab') {
          G.treeBranch = (G.treeBranch + 1) % TREE_BRANCH_LIST.length;
          G.treeLayout = buildTreeLayout();
          selectFirstInBranch();
          sfx('click', { volume: 0.4 });
        } else if (e.key >= '1' && e.key <= '5') {
          const b = Number(e.key) - 1;
          if (b < TREE_BRANCH_LIST.length) {
            G.treeBranch = b;
            G.treeLayout = buildTreeLayout();
            selectFirstInBranch();
            sfx('click', { volume: 0.4 });
          }
        } else if (e.key === 'ArrowLeft') {
          moveTreeSelection(-1, 0);
        } else if (e.key === 'ArrowRight') {
          moveTreeSelection(1, 0);
        } else if (e.key === 'ArrowUp') {
          moveTreeSelection(0, -1);
        } else if (e.key === 'ArrowDown') {
          moveTreeSelection(0, 1);
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (G.treeSelected && buyNode(G.treeSelected)) {
            G.treeBuyFlash = { id: G.treeSelected, at: G.animT };
            const card = treeCardById(G.treeSelected);
            if (card) celebrateBuy(card);
          }
        } else if (e.key === 'h' || e.key === 'H') {
          openHelp();
        }
        return;
      }

      /* ── Help pages ── */
      if (G.state === STATE_HELP) {
        e.preventDefault();
        if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') {
          setScreen(G.helpFrom);
        } else if (e.key === 'ArrowLeft') {
          G.helpPage = Math.max(0, G.helpPage - 1);
          sfx('click', { volume: 0.4 });
        } else if (e.key === 'ArrowRight') {
          G.helpPage = Math.min(HELP_PAGES.length - 1, G.helpPage + 1);
          sfx('click', { volume: 0.4 });
        }
        return;
      }

      /* ── Menu screens, pause and day-over share the hit-area cursor ── */
      if (isMenuState(G.state) || G.state === STATE_PAUSED || G.state === STATE_DAY_OVER) {
        e.preventDefault();
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'w' || e.key === 'W')
          moveMenuCursor(-1);
        else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 's' || e.key === 'S')
          moveMenuCursor(1);
        else if (e.key === 'Enter' || e.key === ' ')
          activateMenuItem(G.hitAreas[Math.min(G.menuCursor, G.hitAreas.length - 1)]);
        else if ((e.key === 'h' || e.key === 'H') && isMenuState(G.state))
          openHelp();
        else if (e.key === 'Escape') {
          if (G.state === STATE_PAUSED)
            resumeDay();
          else if (G.state !== STATE_TITLE)
            setScreen(STATE_TITLE);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        pauseDay();
        return;
      }
      if (G.state !== STATE_PLAYING) return;
      if (e.key === 'b' || e.key === 'B') {
        activateRush();
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= SZ.KitchenData.STATION_ORDER.length)
        clickStation(num - 1);
    });
  }

  NS.input = { attachInput };

})();
