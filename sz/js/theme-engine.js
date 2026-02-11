;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  class ThemeEngine {
    #styleText = '';
    #skin = null;

    generateFromSkin(skin) {
      this.#skin = skin;
      this.#styleText = this.#buildCSS(skin);
    }

    injectInto(iframe) {
      try {
        const doc = iframe.contentDocument;
        if (!doc)
          return;

        let el = doc.getElementById('sz-theme');
        if (!el) {
          el = doc.createElement('style');
          el.id = 'sz-theme';
          doc.head.appendChild(el);
        }
        el.textContent = this.#styleText;
      } catch {
        // Cross-origin iframe — cannot inject
      }
    }

    updateAll(windows) {
      for (const win of windows) {
        const iframe = win.iframe;
        if (iframe) {
          this.injectInto(iframe);
          // Also push via postMessage (works when contentDocument is blocked)
          try {
            iframe.contentWindow?.postMessage({ type: 'sz:themeCSS', css: this.#styleText }, '*');
          } catch (_) {}
        }
      }
    }

    get styleText() { return this.#styleText; }

    #buildCSS(skin) {
      const c = skin.colors;
      const rgb = (arr) => arr ? `rgb(${arr[0]}, ${arr[1]}, ${arr[2]})` : '';

      // All element selectors wrapped in :where() for zero specificity.
      // Any app CSS — even bare element selectors — overrides these defaults.
      // CSS custom properties on :root keep normal specificity so they're
      // available everywhere via var(--sz-color-*).
      return `/* SZ Theme: ${skin.name || 'Unknown'} */
:root {
  --sz-color-scrollbar: ${rgb(c.scrollbar)};
  --sz-color-background: ${rgb(c.background)};
  --sz-color-active-title: ${rgb(c.activeTitle)};
  --sz-color-inactive-title: ${rgb(c.inactiveTitle)};
  --sz-color-menu: ${rgb(c.menu)};
  --sz-color-window: ${rgb(c.window)};
  --sz-color-window-frame: ${rgb(c.windowFrame)};
  --sz-color-menu-text: ${rgb(c.menuText)};
  --sz-color-window-text: ${rgb(c.windowText)};
  --sz-color-title-text: ${rgb(c.titleText)};
  --sz-color-active-border: ${rgb(c.activeBorder)};
  --sz-color-inactive-border: ${rgb(c.inactiveBorder)};
  --sz-color-app-workspace: ${rgb(c.appWorkspace)};
  --sz-color-highlight: ${rgb(c.highlight)};
  --sz-color-highlight-text: ${rgb(c.highlightText)};
  --sz-color-button-face: ${rgb(c.buttonFace)};
  --sz-color-button-shadow: ${rgb(c.buttonShadow)};
  --sz-color-gray-text: ${rgb(c.grayText)};
  --sz-color-button-text: ${rgb(c.buttonText)};
  --sz-color-inactive-title-text: ${rgb(c.inactiveTitleText)};
  --sz-color-button-highlight: ${rgb(c.buttonHighlight)};
  --sz-color-button-dark-shadow: ${rgb(c.buttonDarkShadow)};
  --sz-color-button-light: ${rgb(c.buttonLight)};
  --sz-color-info-text: ${rgb(c.infoText)};
  --sz-color-info-window: ${rgb(c.infoWindow)};
  --sz-color-button-alt-face: ${rgb(c.buttonAlternateFace)};
  --sz-color-hot-tracking: ${rgb(c.hotTrackingColor)};
  --sz-color-gradient-active-title: ${rgb(c.gradientActiveTitle)};
  --sz-color-gradient-inactive-title: ${rgb(c.gradientInactiveTitle)};
  --sz-font-family: '${skin.fonts?.family || 'Tahoma'}', Tahoma, Verdana, sans-serif;
  --sz-font-size: 12px;
}

/* ── Base ─────────────────────────────────────────────────────────── */
:where(body) {
  background: var(--sz-color-button-face);
  color: var(--sz-color-window-text);
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
  margin: 0;
}

/* ── Buttons ──────────────────────────────────────────────────────── */
:where(button, input[type="button"], input[type="submit"], input[type="reset"]) {
  background: var(--sz-color-button-face);
  color: var(--sz-color-button-text);
  border: 2px outset;
  border-color: var(--sz-color-button-highlight) var(--sz-color-button-dark-shadow) var(--sz-color-button-dark-shadow) var(--sz-color-button-highlight);
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
  padding: 2px 8px;
  cursor: default;
  border-radius: 0;
  box-sizing: border-box;
}
:where(button:hover, input[type="button"]:hover, input[type="submit"]:hover) {
  background: var(--sz-color-button-light);
}
:where(button:active, input[type="button"]:active, input[type="submit"]:active) {
  border-style: inset;
  border-color: var(--sz-color-button-dark-shadow) var(--sz-color-button-highlight) var(--sz-color-button-highlight) var(--sz-color-button-dark-shadow);
}
:where(button:disabled) {
  color: var(--sz-color-gray-text);
}

/* ── Text inputs ──────────────────────────────────────────────────── */
:where(input[type="text"], input[type="password"], input[type="number"],
input[type="email"], input[type="url"], input[type="search"],
input[type="tel"], input[type="date"], input[type="time"],
input[type="datetime-local"], textarea) {
  background: var(--sz-color-window);
  color: var(--sz-color-window-text);
  border: 2px inset;
  border-color: var(--sz-color-button-shadow) var(--sz-color-button-highlight) var(--sz-color-button-highlight) var(--sz-color-button-shadow);
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
  padding: 2px 4px;
  border-radius: 0;
  box-sizing: border-box;
}

/* ── Select / dropdown ────────────────────────────────────────────── */
:where(select) {
  background: var(--sz-color-window);
  color: var(--sz-color-window-text);
  border: 1px solid var(--sz-color-button-shadow);
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
  border-radius: 0;
  box-sizing: border-box;
}
:where(option) {
  background: var(--sz-color-window);
  color: var(--sz-color-window-text);
}
:where(option:checked) {
  background: var(--sz-color-highlight);
  color: var(--sz-color-highlight-text);
}

/* ── Checkbox & radio ─────────────────────────────────────────────── */
:where(input[type="checkbox"], input[type="radio"]) {
  accent-color: var(--sz-color-highlight);
  cursor: default;
  margin: 3px;
  vertical-align: middle;
}

/* ── Labels ───────────────────────────────────────────────────────── */
:where(label) {
  cursor: default;
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
  color: var(--sz-color-button-text);
}

/* ── Fieldset & legend ────────────────────────────────────────────── */
:where(fieldset) {
  border: 1px solid var(--sz-color-button-shadow);
  padding: 8px;
  margin: 4px 0;
}
:where(legend) {
  color: var(--sz-color-button-text);
  padding: 0 4px;
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
}

/* ── Tables ───────────────────────────────────────────────────────── */
:where(table) {
  border-collapse: collapse;
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
  color: var(--sz-color-window-text);
}
:where(th) {
  background: var(--sz-color-button-face);
  color: var(--sz-color-button-text);
  border: 1px solid var(--sz-color-button-shadow);
  padding: 2px 6px;
  font-weight: bold;
  text-align: left;
}
:where(td) {
  border: 1px solid var(--sz-color-button-shadow);
  padding: 2px 6px;
}

/* ── Horizontal rule ──────────────────────────────────────────────── */
:where(hr) {
  border: none;
  border-top: 1px solid var(--sz-color-button-shadow);
  border-bottom: 1px solid var(--sz-color-button-highlight);
  margin: 4px 0;
}

/* ── Progress bar ─────────────────────────────────────────────────── */
:where(progress) {
  appearance: none;
  -webkit-appearance: none;
  height: 16px;
  border: 1px solid var(--sz-color-button-shadow);
  background: var(--sz-color-window);
  border-radius: 0;
}
:where(progress)::-webkit-progress-bar {
  background: var(--sz-color-window);
}
:where(progress)::-webkit-progress-value {
  background: var(--sz-color-highlight);
}
:where(progress)::-moz-progress-bar {
  background: var(--sz-color-highlight);
}

/* ── Range / slider ───────────────────────────────────────────────── */
:where(input[type="range"]) {
  accent-color: var(--sz-color-highlight);
}

/* ── Links ────────────────────────────────────────────────────────── */
:where(a) { color: var(--sz-color-hot-tracking); }
:where(a:visited) { color: var(--sz-color-hot-tracking); }

/* ── Disabled ─────────────────────────────────────────────────────── */
:where(:disabled) {
  color: var(--sz-color-gray-text);
}

/* ── Selection ────────────────────────────────────────────────────── */
::selection {
  background: var(--sz-color-highlight);
  color: var(--sz-color-highlight-text);
}

/* ── Focus ────────────────────────────────────────────────────────── */
:where(:focus-visible) {
  outline: 1px dotted var(--sz-color-window-text);
  outline-offset: -1px;
}

/* ── Window panel ─────────────────────────────────────────────────── */
:where(.window) {
  background: var(--sz-color-window);
  color: var(--sz-color-window-text);
  border: 2px outset;
  border-color: var(--sz-color-button-highlight) var(--sz-color-button-dark-shadow) var(--sz-color-button-dark-shadow) var(--sz-color-button-highlight);
}
:where(.sunken) {
  border: 2px inset;
  border-color: var(--sz-color-button-shadow) var(--sz-color-button-highlight) var(--sz-color-button-highlight) var(--sz-color-button-shadow);
}
:where(.raised) {
  border: 2px outset;
  border-color: var(--sz-color-button-highlight) var(--sz-color-button-dark-shadow) var(--sz-color-button-dark-shadow) var(--sz-color-button-highlight);
}
:where(.etched) {
  border: 1px solid var(--sz-color-button-shadow);
}
:where(.status-bar) {
  background: var(--sz-color-button-face);
  border-top: 1px solid var(--sz-color-button-shadow);
  padding: 2px 4px;
  font-size: var(--sz-font-size);
}

/* ── Scrollbars ───────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 16px; height: 16px; }
::-webkit-scrollbar-track { background: var(--sz-color-scrollbar); }
::-webkit-scrollbar-thumb { background: var(--sz-color-button-face); border: 1px solid var(--sz-color-button-shadow); }
::-webkit-scrollbar-button { background: var(--sz-color-button-face); height: 16px; width: 16px; }
:where(*) { scrollbar-color: var(--sz-color-button-face) var(--sz-color-scrollbar); scrollbar-width: auto; }
`;
    }
  }

  SZ.ThemeEngine = ThemeEngine;
})();
