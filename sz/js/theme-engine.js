;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  class ThemeEngine {
    #styleText = '';
    #skin = null;

    async generateFromSkin(skin) {
      this.#skin = skin;
      const controlCSS = await this.#buildControlCSS(skin);
      this.#styleText = this.#buildCSS(skin) + controlCSS;
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

    // -------------------------------------------------------------------
    // Control image loading & processing
    // -------------------------------------------------------------------

    #loadImage(src) {
      if (!src) return Promise.resolve(null);
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }

    // Convert a skin-relative path to an absolute URL so CSS url()
    // references work inside app iframes (whose base URL differs).
    #absUrl(path) {
      if (!path) return '';
      if (/^(blob:|data:|https?:\/\/)/.test(path)) return path;
      try { return new URL(path, document.baseURI).href; }
      catch { return path; }
    }

    // Extract a sub-region from img, apply magenta (255,0,255)
    // transparency and optional mask-based alpha.  Returns a data: URL,
    // or null when the canvas is tainted (file:// cross-origin).
    #processImageRegion(img, sx, sy, sw, sh, maskImg) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        // Magenta transparency
        const id = ctx.getImageData(0, 0, sw, sh);
        const px = id.data;
        for (let i = 0; i < px.length; i += 4)
          if (px[i] === 255 && px[i + 1] === 0 && px[i + 2] === 255)
            px[i + 3] = 0;
        ctx.putImageData(id, 0, 0);

        // Mask-based alpha (greyscale mask → alpha channel)
        if (maskImg) {
          const mc = document.createElement('canvas');
          mc.width = sw;
          mc.height = sh;
          const mctx = mc.getContext('2d');
          mctx.drawImage(maskImg, sx, sy, sw, sh, 0, 0, sw, sh);
          const md = mctx.getImageData(0, 0, sw, sh);
          const mp = md.data;
          for (let i = 0; i < mp.length; i += 4) {
            const grey = Math.round(mp[i] * 0.299 + mp[i + 1] * 0.587 + mp[i + 2] * 0.114);
            mp[i] = mp[i + 1] = mp[i + 2] = 255;
            mp[i + 3] = grey;
          }
          mctx.putImageData(md, 0, 0);
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(mc, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
        }

        return canvas.toDataURL();
      } catch {
        return null;
      }
    }

    // -------------------------------------------------------------------
    // Control CSS orchestrator
    // -------------------------------------------------------------------

    async #buildControlCSS(skin) {
      const b = skin.buttons;
      const pb = skin.progressBar;
      const tc = skin.tabControl;

      const loads = [];
      if (b) {
        loads.push(
          this.#loadImage(b.bitmap),
          this.#loadImage(b.bitmapmask),
          this.#loadImage(b.checkbutton),
          this.#loadImage(b.checkbuttonmask),
          this.#loadImage(b.radiobutton),
        );
      } else {
        loads.push(null, null, null, null, null);
      }
      loads.push((pb?.image || pb?.bitmap) ? this.#loadImage(pb.image || pb.bitmap) : Promise.resolve(null));
      loads.push((tc?.image || tc?.bitmap) ? this.#loadImage(tc.image || tc.bitmap) : Promise.resolve(null));

      const [btnImg, btnMask, checkImg, checkMask, radioImg, progressImg, tabImg] = await Promise.all(loads);

      let css = '';

      if (checkImg) {
        const nf = Math.max(1, Math.floor(checkImg.naturalWidth / checkImg.naturalHeight));
        css += this.#buildCheckRadioCSS('checkbox', checkImg, checkMask, nf, b.checkbutton);
      }

      if (radioImg) {
        const nf = Math.max(1, Math.floor(radioImg.naturalWidth / radioImg.naturalHeight));
        css += this.#buildCheckRadioCSS('radio', radioImg, null, nf, b.radiobutton);
      }

      if (btnImg) {
        const nf = b.framecount || this.#detectButtonFrameCount(btnImg, !!b.mouseover);
        css += this.#buildPushButtonCSS(b, btnImg, btnMask, nf);
      }

      if (progressImg && pb)
        css += this.#buildProgressBarCSS(pb, progressImg);

      if (tabImg && tc)
        css += this.#buildTabControlCSS(tc, tabImg);

      return css;
    }

    #detectButtonFrameCount(img, mouseover) {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const fits = (n) => n > 0 && w % n === 0 && w / n >= h * 0.5;
      // UIS spec: 5 states (Normal, Pressed, Disabled, Focus, Default)
      // Animated skins may have 6+ frames; 6 checked before 3 for mouseover skins
      if (fits(5)) return 5;
      if (mouseover && fits(6)) return 6;
      if (fits(4)) return 4;
      if (fits(3)) return 3;
      if (fits(2)) return 2;
      return Math.max(1, Math.round(w / h));
    }

    // -------------------------------------------------------------------
    // Checkbox / radio — HORIZONTAL strip of square frames
    //
    // Frame count detected from image: numFrames = width / height.
    //   4 frames: unchecked(0) checked(1) disabled-off(2) disabled-on(3)
    //   6 frames: +hover-off(2) hover-on(3), disabled shifts to 4,5
    //   8 frames: +pressed-off(4) pressed-on(5), disabled shifts to 6,7
    // -------------------------------------------------------------------

    #buildCheckRadioCSS(type, img, maskImg, numFrames, rawPath) {
      const fw = Math.floor(img.naturalWidth / numFrames);
      const fh = img.naturalHeight;
      const sel = `input[type="${type}"]`;

      // Try canvas extraction for each frame
      const dataUrls = [];
      for (let i = 0; i < numFrames; ++i) {
        const url = this.#processImageRegion(img, i * fw, 0, fw, fh, maskImg);
        if (!url) { dataUrls.length = 0; break; }
        dataUrls.push(url);
      }

      const useData = dataUrls.length === numFrames;
      const absRawUrl = useData ? null : this.#absUrl(rawPath);

      // CSS background for frame f (data URL or raw sprite positioning)
      const bg = (f) => {
        if (useData)
          return `url("${dataUrls[f]}") no-repeat 0 0 / 100% 100%`;
        const pct = numFrames > 1 ? `${(f * 100 / (numFrames - 1)).toFixed(4)}%` : '0%';
        return `url("${absRawUrl}") no-repeat ${pct} 0% / ${numFrames * 100}% 100%`;
      };

      let css = `
/* ── Skinned ${type} ───────────────────────────────────────────── */
:where(${sel}) {
  appearance: none;
  -webkit-appearance: none;
  width: ${fw}px;
  height: ${fh}px;
  background: ${bg(0)};
  vertical-align: middle;
  margin: 3px;
  cursor: default;
  border: none;
  flex-shrink: 0;
}
:where(${sel}:checked) { background: ${bg(1)}; }`;

      if (numFrames >= 8)
        css += `
:where(${sel}:hover:not(:checked):not(:disabled)) { background: ${bg(2)}; }
:where(${sel}:hover:checked:not(:disabled)) { background: ${bg(3)}; }
:where(${sel}:active:not(:checked)) { background: ${bg(4)}; }
:where(${sel}:active:checked) { background: ${bg(5)}; }
:where(${sel}:disabled:not(:checked)) { background: ${bg(6)}; }
:where(${sel}:disabled:checked) { background: ${bg(7)}; }`;
      else if (numFrames >= 6)
        css += `
:where(${sel}:hover:not(:checked):not(:disabled)) { background: ${bg(2)}; }
:where(${sel}:hover:checked:not(:disabled)) { background: ${bg(3)}; }
:where(${sel}:disabled:not(:checked)) { background: ${bg(4)}; }
:where(${sel}:disabled:checked) { background: ${bg(5)}; }`;
      else if (numFrames >= 4)
        css += `
:where(${sel}:disabled:not(:checked)) { background: ${bg(2)}; }
:where(${sel}:disabled:checked) { background: ${bg(3)}; }`;

      return css + '\n';
    }

    // -------------------------------------------------------------------
    // Push button — HORIZONTAL strip, one frame per state.
    // Whole frame stretched as background-image; padding acts as border.
    //
    // Frame mapping depends on mouseover flag:
    //   mouseover=0 (4 frames): Normal(0) Pressed(1) Disabled(2) Default(3)
    //   mouseover=1 (5 frames): Normal(0) Hover(1) Pressed(2) Disabled(3) Default(4)
    //   Animated skins may override hover index via mouseoverstartframe.
    //
    // Canvas path: extract each frame as data URL, use as background.
    // Raw fallback: background-position on the sprite strip.
    // -------------------------------------------------------------------

    #buildPushButtonCSS(buttons, img, maskImg, numFrames) {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const frameW = Math.floor(w / numFrames);
      const top = buttons.topheight || 3;
      const bottom = buttons.bottomheight || 3;
      const left = buttons.leftwidth || 3;
      const right = buttons.rightwidth || 3;
      const sel = 'button, input[type="button"], input[type="submit"], input[type="reset"]';

      // UIS spec button states: 1=Normal, 2=Pressed, 3=Disabled, 4=Focus, 5=Default
      // When MouseOver=1, Focus frame (3) doubles as hover visual.
      // Animated skins with framecount > 5 may specify mouseoverstartframe /
      // mouseenterstartframe — use those as the hover visual explicitly.
      const mouseover = !!buttons.mouseover;
      const normalIdx = 0;
      const pressedIdx = numFrames >= 2 ? 1 : 0;
      const disabledIdx = numFrames >= 3 ? 2 : -1;
      let hoverIdx;
      if (mouseover) {
        hoverIdx = buttons.mouseoverstartframe != null ? buttons.mouseoverstartframe
                 : buttons.mouseenterstartframe != null ? buttons.mouseenterstartframe
                 : numFrames >= 4 ? 3 : -1;
      } else {
        hoverIdx = -1;
      }

      // Try canvas extraction for each frame
      const dataUrls = [];
      for (let i = 0; i < numFrames; ++i) {
        const url = this.#processImageRegion(img, i * frameW, 0, frameW, h, maskImg);
        if (!url) { dataUrls.length = 0; break; }
        dataUrls.push(url);
      }

      if (dataUrls.length === numFrames)
        return this.#buildPushButtonData(sel, dataUrls, top, right, bottom, left, normalIdx, hoverIdx, pressedIdx, disabledIdx);

      // Fallback: raw URL with background-position frame selection
      return this.#buildPushButtonRaw(sel, this.#absUrl(buttons.bitmap), numFrames, top, right, bottom, left, normalIdx, hoverIdx, pressedIdx, disabledIdx);
    }

    // Canvas-extracted per-frame data URLs — border-image 9-slice per state.
    // border-image-slice cuts the frame into 9 cells: fixed corners, stretched
    // edges, and a filled center (the `fill` keyword).  This preserves the
    // skin artist's rounded corners and decorative borders at any button size.
    #buildPushButtonData(sel, dataUrls, top, right, bottom, left, normalIdx, hoverIdx, pressedIdx, disabledIdx) {
      const bi = (idx) => `url("${dataUrls[idx]}") ${top} ${right} ${bottom} ${left} fill stretch`;
      let css = `
/* ── Skinned push buttons (data, 9-slice) ──────────────────── */
:where(${sel}) {
  appearance: none;
  -webkit-appearance: none;
  border-style: solid;
  border-width: ${top}px ${right}px ${bottom}px ${left}px;
  border-image: ${bi(normalIdx)};
  background: none;
  color: var(--sz-color-button-text);
  padding: 1px 4px;
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
  cursor: default;
  border-radius: 0;
  box-sizing: border-box;
}`;
      if (hoverIdx >= 0)
        css += `
:where(${sel}):where(:hover:not(:disabled):not(:active)) { border-image: ${bi(hoverIdx)}; }`;
      css += `
:where(${sel}):where(:active) { border-image: ${bi(pressedIdx)}; }`;
      if (disabledIdx >= 0 && disabledIdx < dataUrls.length)
        css += `
:where(${sel}):where(:disabled) { border-image: ${bi(disabledIdx)}; color: var(--sz-color-gray-text); }`;
      else
        css += `
:where(${sel}):where(:disabled) { color: var(--sz-color-gray-text); }`;
      return css + '\n';
    }

    // Raw sprite fallback — background-position selects the frame from
    // the horizontal strip.  Used only when canvas is tainted (file://
    // protocol).  Cannot do proper 9-slice with a sprite strip, so the
    // entire frame stretches to fill the button (degraded visual).
    #buildPushButtonRaw(sel, url, numFrames, top, right, bottom, left, normalIdx, hoverIdx, pressedIdx, disabledIdx) {
      const pos = (idx) => numFrames > 1
        ? `${(idx * 100 / (numFrames - 1)).toFixed(4)}% 0%`
        : '0% 0%';
      const bgBase = `url("${url}") no-repeat`;
      const bgSize = `${numFrames * 100}% 100%`;

      let css = `
/* ── Skinned push buttons (raw sprite) ───────────────────────── */
:where(${sel}) {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  border-image: none;
  background: ${bgBase} ${pos(normalIdx)} / ${bgSize};
  color: var(--sz-color-button-text);
  padding: ${top}px ${right}px ${bottom}px ${left}px;
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
  cursor: default;
  border-radius: 0;
  box-sizing: border-box;
}`;
      if (hoverIdx >= 0)
        css += `
:where(${sel}):where(:hover:not(:disabled):not(:active)) { background: ${bgBase} ${pos(hoverIdx)} / ${bgSize}; }`;
      css += `
:where(${sel}):where(:active) { background: ${bgBase} ${pos(pressedIdx)} / ${bgSize}; }`;
      if (disabledIdx >= 0)
        css += `
:where(${sel}):where(:disabled) { background: ${bgBase} ${pos(disabledIdx)} / ${bgSize}; color: var(--sz-color-gray-text); }`;
      else
        css += `
:where(${sel}):where(:disabled) { color: var(--sz-color-gray-text); }`;
      return css + '\n';
    }

    // -------------------------------------------------------------------
    // Progress bar — PROGRESS.BMP
    //
    // The image is typically a small chunk tile.  We use it as the
    // progress value fill via border-image 9-slice, falling back to
    // a tiled background if canvas fails.
    // -------------------------------------------------------------------

    #buildProgressBarCSS(pb, img) {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const top = pb.topheight || 1;
      const bottom = pb.bottomheight || 1;
      const left = pb.leftwidth || 1;
      const right = pb.rightwidth || 1;

      // Progress BMP may contain 2-3 horizontal frames:
      //   2 frames: track(0), fill(1)
      //   3 frames: track(0), fill(1), chunk/segment(2)
      //   1 frame:  fill only (track = solid color)
      const fits = (n) => n > 0 && w % n === 0 && w / n >= h * 0.5;
      const numFrames = pb.framecount || (fits(2) ? 2 : fits(3) ? 3 : 1);
      const frameW = Math.floor(w / numFrames);
      const trackIdx = numFrames >= 2 ? 0 : -1;
      const fillIdx = numFrames >= 2 ? 1 : 0;

      const extractFrame = (idx) => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = frameW;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, idx * frameW, 0, frameW, h, 0, 0, frameW, h);
          const id = ctx.getImageData(0, 0, frameW, h);
          const px = id.data;
          for (let i = 0; i < px.length; i += 4)
            if (px[i] === 255 && px[i + 1] === 0 && px[i + 2] === 255)
              px[i + 3] = 0;
          ctx.putImageData(id, 0, 0);
          return canvas.toDataURL();
        } catch { return null; }
      };

      const fillUrl = extractFrame(fillIdx);
      const trackUrl = trackIdx >= 0 ? extractFrame(trackIdx) : null;
      const rawUrl = this.#absUrl(pb.image || pb.bitmap);
      const fillSrc = fillUrl || rawUrl;

      // UIS [Progress] tiling: Tile=0 → both stretch; Tile≥1 → tiling enabled
      // TileMode refines: 0=both tile, 1=back stretch + bar tile, 2=back tile + bar stretch
      const tile = pb.tile || 0;
      const tileMode = pb.tilemode || 0;
      const trackTileKeyword = (tile && (tileMode === 0 || tileMode === 2)) ? 'round' : 'stretch';
      const fillTileKeyword = (tile && (tileMode === 0 || tileMode === 1)) ? 'round' : 'stretch';

      const fillBi = `url("${fillSrc}") ${top} ${right} ${bottom} ${left} fill ${fillTileKeyword}`;
      // Track frame: also 9-sliced to preserve border detail at any width
      const trackBi = trackUrl
        ? `url("${trackUrl}") ${top} ${right} ${bottom} ${left} fill ${trackTileKeyword}`
        : null;
      const trackBg = trackBi ? 'none' : 'var(--sz-color-button-face)';

      return `
/* ── Skinned progress bar ──────────────────────────────────── */
:where(progress) {
  appearance: none;
  -webkit-appearance: none;
  height: ${h}px;
  border-style: solid;
  border-width: ${trackBi ? top : 0}px ${trackBi ? right : 0}px ${trackBi ? bottom : 0}px ${trackBi ? left : 0}px;
  ${trackBi ? `border-image: ${trackBi};` : `border: none;`}
  background: ${trackBg};
  border-radius: 0;
  overflow: hidden;
}
:where(progress)::-webkit-progress-bar {
  background: ${trackBg};
  border-radius: 0;
}
:where(progress)::-webkit-progress-value {
  border-style: solid;
  border-width: ${top}px ${right}px ${bottom}px ${left}px;
  border-image: ${fillBi};
  background: none;
  border-radius: 0;
}
:where(progress)::-moz-progress-bar {
  border-style: solid;
  border-width: ${top}px ${right}px ${bottom}px ${left}px;
  border-image: ${fillBi};
  background: none;
  border-radius: 0;
}
`;
    }

    // -------------------------------------------------------------------
    // Tab control — TAB.BMP
    //
    // Horizontal strip: Normal(0), Active(1), Hover(2 if exists).
    // Applied to elements with .sz-tab / [role="tab"] via border-image.
    // -------------------------------------------------------------------

    #buildTabControlCSS(tc, img) {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      // WindowBlinds button format: 5 states (Normal, Pressed, Disabled, Focus, Default)
      const fits = (n) => n > 0 && w % n === 0 && w / n >= h * 0.5;
      const numFrames = tc.framecount || (fits(5) ? 5 : fits(4) ? 4 : fits(3) ? 3 : fits(2) ? 2 : Math.max(1, Math.round(w / h)));
      const frameW = Math.floor(w / numFrames);
      const top = tc.topheight || 3;
      const bottom = tc.bottomheight || 3;
      const left = tc.leftwidth || 3;
      const right = tc.rightwidth || 3;

      // Normal(0), Active/Selected(1=Pressed), Hover(3=Focus)
      const normalIdx = 0;
      const activeIdx = numFrames >= 2 ? 1 : 0;
      const hoverIdx = numFrames >= 4 ? 3 : -1;

      const dataUrls = [];
      for (let i = 0; i < numFrames; ++i) {
        const url = this.#processImageRegion(img, i * frameW, 0, frameW, h, null);
        if (!url) { dataUrls.length = 0; break; }
        dataUrls.push(url);
      }

      const tileKeyword = tc.tile ? 'round' : 'stretch';
      const sel = ':where(.sz-tab, [role="tab"])';
      if (dataUrls.length === numFrames) {
        const bi = (idx) => `url("${dataUrls[idx]}") ${top} ${right} ${bottom} ${left} fill ${tileKeyword}`;
        let css = `
/* ── Skinned tabs (9-slice) ────────────────────────────────── */
${sel} {
  appearance: none;
  -webkit-appearance: none;
  border-style: solid;
  border-width: ${top}px ${right}px ${bottom}px ${left}px;
  border-image: ${bi(normalIdx)};
  background: none;
  padding: 2px 8px;
  cursor: default;
  border-radius: 0;
}
${sel}:where(.active, [aria-selected="true"], .sz-tab-active) {
  border-image: ${bi(activeIdx)};
}`;
        if (hoverIdx >= 0)
          css += `
${sel}:where(:hover:not(.active):not([aria-selected="true"]):not(.sz-tab-active)) {
  border-image: ${bi(hoverIdx)};
}`;
        return css + '\n';
      }

      // Raw fallback
      const absUrl = this.#absUrl(tc.image || tc.bitmap);
      const pos = (idx) => numFrames > 1 ? `${(idx * 100 / (numFrames - 1)).toFixed(4)}% 0%` : '0% 0%';
      const bgSize = `${numFrames * 100}% 100%`;
      let css = `
/* ── Skinned tabs (raw fallback) ───────────────────────────── */
${sel} {
  appearance: none;
  background: url("${absUrl}") no-repeat ${pos(normalIdx)} / ${bgSize};
  border: none;
  padding: ${top}px ${right}px ${bottom}px ${left}px;
  cursor: default;
  border-radius: 0;
}
${sel}:where(.active, [aria-selected="true"], .sz-tab-active) {
  background-position: ${pos(activeIdx)};
}`;
      if (hoverIdx >= 0)
        css += `
${sel}:where(:hover:not(.active):not([aria-selected="true"]):not(.sz-tab-active)) {
  background-position: ${pos(hoverIdx)};
}`;
      return css + '\n';
    }

    // -------------------------------------------------------------------
    // Base CSS — colors, fonts, element styling from skin system colors
    // -------------------------------------------------------------------

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
