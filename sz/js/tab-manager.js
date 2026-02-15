;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  let _nextGroupId = 0;

  const DRAG_THRESHOLD = 5;    // px before drag starts
  const DETACH_DISTANCE = 40;  // px from bar center before window detaches

  /**
   * TidyTabs-style tab group manager.
   *
   * Key design: There is no fixed "host" window. The tab bar always lives on
   * the currently active window (positioned absolutely above it via CSS).
   * When switching tabs the bar migrates. When a window is closed or detached,
   * the bar migrates to the next active window.
   *
   * Each window keeps its own natural size — non-resizable windows are never
   * forced to a different size. Only position (top-left) is shared between
   * tabs; resizable windows additionally inherit the previous tab's size.
   *
   * Tab drag supports:
   *  - Reorder: drag tabs horizontally within the bar
   *  - Detach: drag a tab far enough vertically to pull the window out
   *  - Merge: drag a detached tab-window onto another window's title bar
   */
  class TabManager {
    /** groupId → { windowIds: string[], activeId: string, tabBarEl: HTMLElement|null } */
    #groups = new Map();
    /** windowId → groupId */
    #windowToGroup = new Map();
    #windowManager;
    /** Merge-target highlight during window-drag (from pointer-handler). */
    #mergeTarget = null;
    /** Active tab drag state, or null. */
    #tabDrag = null;

    constructor(windowManager) {
      this.#windowManager = windowManager;
    }

    // =================================================================
    // Public API
    // =================================================================

    /**
     * Create a tab group from two windows.
     * Returns the group ID, or null if grouping isn't possible.
     */
    createGroup(targetId, draggedId) {
      const tg = this.#windowToGroup.get(targetId);
      const dg = this.#windowToGroup.get(draggedId);
      if (tg && dg && tg === dg)
        return tg;

      if (tg) {
        this.addToGroup(tg, draggedId);
        return tg;
      }

      if (dg) {
        this.addToGroup(dg, targetId);
        return dg;
      }

      const groupId = `tab-group-${++_nextGroupId}`;

      const group = {
        windowIds: [targetId, draggedId],
        activeId: targetId,
        tabBarEl: null,
      };

      this.#groups.set(groupId, group);
      this.#windowToGroup.set(targetId, groupId);
      this.#windowToGroup.set(draggedId, groupId);

      const targetWin = this.#windowManager.getWindow(targetId);
      const draggedWin = this.#windowManager.getWindow(draggedId);
      if (targetWin && draggedWin) {
        const pos = targetWin.getPosition();
        draggedWin.moveTo(pos.x, pos.y);
        if (draggedWin.resizable) {
          const size = targetWin.getSize();
          draggedWin.resizeTo(size.width, size.height);
        }
      }

      this.#applyVisibility(groupId);
      this.#attachTabBar(groupId);
      return groupId;
    }

    addToGroup(groupId, windowId) {
      const group = this.#groups.get(groupId);
      if (!group || group.windowIds.includes(windowId))
        return;

      const existingGroup = this.#windowToGroup.get(windowId);
      if (existingGroup)
        this.detach(windowId);

      group.windowIds.push(windowId);
      this.#windowToGroup.set(windowId, groupId);

      const activeWin = this.#windowManager.getWindow(group.activeId);
      const newWin = this.#windowManager.getWindow(windowId);
      if (activeWin && newWin) {
        const pos = activeWin.getPosition();
        newWin.moveTo(pos.x, pos.y);
        if (newWin.resizable) {
          const size = activeWin.getSize();
          newWin.resizeTo(size.width, size.height);
        }
      }

      this.#applyVisibility(groupId);
      this.#attachTabBar(groupId);
    }

    detach(windowId) {
      const groupId = this.#windowToGroup.get(windowId);
      if (!groupId)
        return;

      const group = this.#groups.get(groupId);
      if (!group)
        return;

      this.#removeTabBar(groupId);

      group.windowIds = group.windowIds.filter(id => id !== windowId);
      this.#windowToGroup.delete(windowId);

      const win = this.#windowManager.getWindow(windowId);
      if (win) {
        win.element.style.display = '';
        win.element.classList.remove('sz-tabbed');
      }

      if (group.activeId === windowId && group.windowIds.length > 0)
        group.activeId = group.windowIds[0];

      if (group.windowIds.length <= 1) {
        if (group.windowIds.length === 1) {
          const lastId = group.windowIds[0];
          this.#windowToGroup.delete(lastId);
          const lastWin = this.#windowManager.getWindow(lastId);
          if (lastWin) {
            lastWin.element.style.display = '';
            lastWin.element.classList.remove('sz-tabbed');
          }
        }
        this.#groups.delete(groupId);
        return;
      }

      this.#applyVisibility(groupId);
      this.#attachTabBar(groupId);
    }

    activateTab(groupId, windowId) {
      const group = this.#groups.get(groupId);
      if (!group || !group.windowIds.includes(windowId))
        return;

      if (group.activeId === windowId)
        return;

      const prevWin = this.#windowManager.getWindow(group.activeId);
      let refPos = null;
      let refSize = null;
      if (prevWin) {
        refPos = prevWin.getPosition();
        refSize = prevWin.getSize();
      }

      this.#removeTabBar(groupId);
      group.activeId = windowId;

      const newWin = this.#windowManager.getWindow(windowId);
      if (newWin && refPos) {
        newWin.moveTo(refPos.x, refPos.y);
        if (newWin.resizable && refSize)
          newWin.resizeTo(refSize.width, refSize.height);
      }

      this.#applyVisibility(groupId);
      this.#attachTabBar(groupId);
    }

    getGroup(windowId) {
      return this.#windowToGroup.get(windowId) || null;
    }

    /** Called during window-drag (from pointer-handler) to detect merge. */
    detectMerge(draggedId, draggedRect, cursorX, cursorY) {
      if (this.#windowToGroup.has(draggedId))
        return;

      if (this.#mergeTarget) {
        const prevWin = this.#windowManager.getWindow(this.#mergeTarget.windowId);
        if (prevWin)
          prevWin.element.classList.remove('sz-tab-merge-target');
        this.#mergeTarget = null;
      }

      const rects = this.#windowManager.getVisibleWindowRects(draggedId);
      for (const r of rects) {
        if (cursorX >= r.x && cursorX <= r.x + r.width &&
            cursorY >= r.y && cursorY <= r.y + 35) {
          const targetWin = this.#windowManager.getWindow(r.id);
          if (targetWin) {
            targetWin.element.classList.add('sz-tab-merge-target');
            this.#mergeTarget = { windowId: r.id, groupId: this.#windowToGroup.get(r.id) || null };
          }
          return;
        }
      }
    }

    /** Called on pointer-up after window-drag to finalize merge. */
    completeMerge(draggedId) {
      if (!this.#mergeTarget)
        return;

      const targetWin = this.#windowManager.getWindow(this.#mergeTarget.windowId);
      if (targetWin)
        targetWin.element.classList.remove('sz-tab-merge-target');

      if (this.#mergeTarget.groupId)
        this.addToGroup(this.#mergeTarget.groupId, draggedId);
      else
        this.createGroup(this.#mergeTarget.windowId, draggedId);

      this.#mergeTarget = null;
    }

    onWindowClosed(windowId) {
      if (this.#windowToGroup.has(windowId))
        this.detach(windowId);
    }

    // =================================================================
    // Tab Drag — reorder / detach / merge
    // =================================================================

    /** Bound pointermove handler for tab drag. */
    #onTabDragMove = (e) => {
      const drag = this.#tabDrag;
      if (!drag)
        return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      // -- Pending: waiting for threshold ------------------------------------
      if (drag.phase === 'pending') {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD)
          return;

        // Passed threshold — start as reorder
        drag.phase = 'reorder';
        drag.tabEl.classList.add('sz-tab-dragging');

        // Force the tab bar visible during drag
        const group = this.#groups.get(drag.groupId);
        if (group?.tabBarEl) {
          group.tabBarEl.style.opacity = '1';
          group.tabBarEl.style.pointerEvents = 'auto';
        }
      }

      // -- Reorder phase -----------------------------------------------------
      if (drag.phase === 'reorder') {
        // Check if cursor moved far enough from bar to detach
        const barCenterY = drag.barRect.top + drag.barRect.height / 2;
        if (Math.abs(e.clientY - barCenterY) > DETACH_DISTANCE) {
          drag.tabEl.classList.remove('sz-tab-dragging');
          this.#transitionToDetached(drag, e);
          return;
        }

        // Reorder: swap DOM position based on cursor X
        this.#reorderAtCursor(drag, e.clientX);
        return;
      }

      // -- Detached phase ----------------------------------------------------
      if (drag.phase === 'detached') {
        const win = this.#windowManager.getWindow(drag.windowId);
        if (!win)
          return;

        const container = this.#windowManager.container;
        const cr = container.getBoundingClientRect();
        win.moveTo(
          e.clientX - cr.left - drag.grabOffsetX,
          e.clientY - cr.top - drag.grabOffsetY
        );

        this.#detectTabDragMerge(drag, e);
      }
    };

    /** Bound pointerup handler for tab drag. */
    #onTabDragEnd = (e) => {
      const drag = this.#tabDrag;
      this.#tabDrag = null;

      document.removeEventListener('pointermove', this.#onTabDragMove, true);
      document.removeEventListener('pointerup', this.#onTabDragEnd, true);

      if (!drag)
        return;

      // -- Pending → was a click, not a drag ---------------------------------
      if (drag.phase === 'pending') {
        this.activateTab(drag.groupId, drag.windowId);
        this.#windowManager.focusWindow(drag.windowId);
        return;
      }

      // -- Reorder → finalize tab order --------------------------------------
      if (drag.phase === 'reorder') {
        drag.tabEl.classList.remove('sz-tab-dragging');

        // Restore auto-opacity on bar
        const group = this.#groups.get(drag.groupId);
        if (group?.tabBarEl) {
          group.tabBarEl.style.opacity = '';
          group.tabBarEl.style.pointerEvents = '';
        }

        this.#finalizeTabOrder(drag);
        return;
      }

      // -- Detached → check merge target or leave standalone -----------------
      if (drag.phase === 'detached') {
        if (drag.mergeTarget) {
          const targetWin = this.#windowManager.getWindow(drag.mergeTarget.windowId);
          if (targetWin)
            targetWin.element.classList.remove('sz-tab-merge-target');

          if (drag.mergeTarget.groupId)
            this.addToGroup(drag.mergeTarget.groupId, drag.windowId);
          else
            this.createGroup(drag.mergeTarget.windowId, drag.windowId);
        }
        // Otherwise: window stays standalone where the user dropped it
      }
    };

    // =================================================================
    // Private helpers
    // =================================================================

    #applyVisibility(groupId) {
      const group = this.#groups.get(groupId);
      if (!group)
        return;

      for (const id of group.windowIds) {
        const win = this.#windowManager.getWindow(id);
        if (!win)
          continue;
        win.element.style.display = id === group.activeId ? '' : 'none';
      }
    }

    /**
     * Build the tab bar DOM and attach it to the active window.
     * Tab pointerdown starts the drag-aware handler.
     */
    #attachTabBar(groupId) {
      const group = this.#groups.get(groupId);
      if (!group)
        return;

      this.#removeTabBar(groupId);

      const activeWin = this.#windowManager.getWindow(group.activeId);
      if (!activeWin)
        return;

      const bar = document.createElement('div');
      bar.className = 'sz-tab-bar';
      bar.dataset.groupId = groupId;

      for (const windowId of group.windowIds) {
        const win = this.#windowManager.getWindow(windowId);
        if (!win)
          continue;

        const tab = document.createElement('div');
        tab.className = 'sz-tab';
        tab.dataset.windowId = windowId;
        if (windowId === group.activeId)
          tab.classList.add('active');

        if (win.icon) {
          const img = document.createElement('img');
          img.src = win.icon;
          img.alt = '';
          img.draggable = false;
          tab.appendChild(img);
        }

        const label = document.createElement('span');
        label.className = 'sz-tab-label';
        label.textContent = win.title;
        tab.appendChild(label);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'sz-tab-close';
        closeBtn.textContent = '\u00D7';
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.detach(windowId);
          this.#windowManager.closeWindow(windowId);
        });
        tab.appendChild(closeBtn);

        // Drag-aware pointerdown: click activates, drag reorders / detaches
        tab.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.sz-tab-close'))
            return;
          e.stopPropagation();
          e.preventDefault();
          this.#startTabDrag(groupId, windowId, tab, bar, e);
        });

        bar.appendChild(tab);
      }

      group.tabBarEl = bar;

      const el = activeWin.element;
      el.classList.add('sz-tabbed');
      el.insertBefore(bar, el.firstChild);
    }

    #removeTabBar(groupId) {
      const group = this.#groups.get(groupId);
      if (!group?.tabBarEl)
        return;

      const parent = group.tabBarEl.parentElement;
      if (parent)
        parent.classList.remove('sz-tabbed');

      group.tabBarEl.remove();
      group.tabBarEl = null;
    }

    // -- Tab drag helpers --

    #startTabDrag(groupId, windowId, tabEl, barEl, e) {
      this.#tabDrag = {
        groupId,
        windowId,
        tabEl,
        barEl,
        startX: e.clientX,
        startY: e.clientY,
        barRect: barEl.getBoundingClientRect(),
        phase: 'pending',   // 'pending' | 'reorder' | 'detached'
        mergeTarget: null,
        grabOffsetX: 0,
        grabOffsetY: 0,
      };

      document.addEventListener('pointermove', this.#onTabDragMove, true);
      document.addEventListener('pointerup', this.#onTabDragEnd, true);
    }

    /**
     * Transition from reorder → detached: pull the window out of the group.
     */
    #transitionToDetached(drag, e) {
      drag.phase = 'detached';

      // Activate this tab first if it isn't already (so the window is visible)
      const group = this.#groups.get(drag.groupId);
      if (group && group.activeId !== drag.windowId) {
        this.activateTab(drag.groupId, drag.windowId);
        this.#windowManager.focusWindow(drag.windowId);
      }

      const win = this.#windowManager.getWindow(drag.windowId);
      if (!win)
        return;

      // Compute grab offset: center the title bar under the cursor
      const size = win.getSize();
      drag.grabOffsetX = Math.min(size.width / 2, 120);
      drag.grabOffsetY = 15;

      // Detach from the group (shows the window, removes tab bar from old group)
      this.detach(drag.windowId);

      // Position at cursor
      const container = this.#windowManager.container;
      const cr = container.getBoundingClientRect();
      win.moveTo(
        e.clientX - cr.left - drag.grabOffsetX,
        e.clientY - cr.top - drag.grabOffsetY
      );
    }

    /**
     * During reorder phase, swap the dragged tab's DOM position based on
     * cursor X relative to sibling tab centers.
     */
    #reorderAtCursor(drag, clientX) {
      const tabs = Array.from(drag.barEl.querySelectorAll('.sz-tab'));
      const dragIdx = tabs.indexOf(drag.tabEl);
      if (dragIdx < 0)
        return;

      for (let i = 0; i < tabs.length; ++i) {
        if (i === dragIdx)
          continue;
        const rect = tabs[i].getBoundingClientRect();
        const center = rect.left + rect.width / 2;

        if (i < dragIdx && clientX < center) {
          drag.barEl.insertBefore(drag.tabEl, tabs[i]);
          return;
        }
        if (i > dragIdx && clientX > center) {
          const next = tabs[i].nextSibling;
          if (next)
            drag.barEl.insertBefore(drag.tabEl, next);
          else
            drag.barEl.appendChild(drag.tabEl);
          return;
        }
      }
    }

    /**
     * After a reorder drag ends, read the DOM order and persist it
     * into the group's windowIds array.
     */
    #finalizeTabOrder(drag) {
      const group = this.#groups.get(drag.groupId);
      if (!group?.tabBarEl)
        return;

      const newOrder = [];
      for (const tab of group.tabBarEl.querySelectorAll('.sz-tab')) {
        const wid = tab.dataset.windowId;
        if (group.windowIds.includes(wid))
          newOrder.push(wid);
      }

      if (newOrder.length === group.windowIds.length)
        group.windowIds = newOrder;
    }

    /**
     * During the detached phase, check if the cursor hovers over another
     * window's title bar and highlight it as a merge target.
     */
    #detectTabDragMerge(drag, e) {
      // Clear previous
      if (drag.mergeTarget) {
        const prevWin = this.#windowManager.getWindow(drag.mergeTarget.windowId);
        if (prevWin)
          prevWin.element.classList.remove('sz-tab-merge-target');
        drag.mergeTarget = null;
      }

      const container = this.#windowManager.container;
      const cr = container.getBoundingClientRect();
      const relX = e.clientX - cr.left;
      const relY = e.clientY - cr.top;

      const rects = this.#windowManager.getVisibleWindowRects(drag.windowId);
      for (const r of rects) {
        if (relX >= r.x && relX <= r.x + r.width &&
            relY >= r.y && relY <= r.y + 35) {
          const targetWin = this.#windowManager.getWindow(r.id);
          if (targetWin) {
            targetWin.element.classList.add('sz-tab-merge-target');
            drag.mergeTarget = {
              windowId: r.id,
              groupId: this.#windowToGroup.get(r.id) || null,
            };
          }
          return;
        }
      }
    }
  }

  SZ.TabManager = TabManager;
})();
