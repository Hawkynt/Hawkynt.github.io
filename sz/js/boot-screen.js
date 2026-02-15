;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /**
   * BootScreen - Shows an animated boot/splash screen during initial asset loading.
   *
   * Supports three display modes:
   *   1. GIF mode       - displays a single animated GIF
   *   2. Frame sequence  - cycles BMP/PNG frames on a <canvas> at configurable FPS
   *   3. CSS fallback    - pure-CSS logo animation with pulsing letters and bouncing dots
   */
  class BootScreen {
    #container;
    #animationFrameId = null;

    constructor(containerElement) {
      this.#container = containerElement;
    }

    async show(config) {
      this.#container.innerHTML = '';
      this.#container.classList.remove('sz-boot-hidden');

      if (config?.type === 'gif')
        this.#buildGifMode(config);
      else if (config?.type === 'frames')
        await this.#buildFrameMode(config);
      else
        this.#buildCssFallback();

      this.#container.style.display = '';
      this.#container.style.opacity = '1';
    }

    setProgress(percent, message) {
      const bar = this.#container.querySelector('.sz-boot-progress-bar');
      if (bar)
        bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;

      const status = this.#container.querySelector('.sz-boot-status');
      if (status && message !== undefined)
        status.textContent = message;
    }

    async hide() {
      this.#container.classList.add('sz-boot-hidden');
      await new Promise(resolve => setTimeout(resolve, 500));
      this.#container.style.display = 'none';
    }

    destroy() {
      if (this.#animationFrameId !== null) {
        cancelAnimationFrame(this.#animationFrameId);
        this.#animationFrameId = null;
      }
      this.#container.innerHTML = '';
      this.#container.style.display = 'none';
    }

    #buildCssFallback() {
      this.#container.innerHTML = `
        <div class="sz-boot-content">
          <div class="sz-boot-logo">
            <span class="sz-boot-logo-s">Z</span>
            <span class="sz-boot-logo-z">Z</span>
          </div>
          <div class="sz-boot-subtitle">&raquo;SynthelicZ&laquo; Desktop</div>
          <div class="sz-boot-spinner">
            <div class="sz-boot-dot"></div>
            <div class="sz-boot-dot"></div>
            <div class="sz-boot-dot"></div>
          </div>
          <div class="sz-boot-progress">
            <div class="sz-boot-progress-bar"></div>
          </div>
          <div class="sz-boot-status">Loading...</div>
        </div>`;
    }

    #buildGifMode(config) {
      this.#container.innerHTML = `
        <div class="sz-boot-content">
          <img class="sz-boot-gif" src="${config.src}" alt="Loading..." />
          <div class="sz-boot-progress">
            <div class="sz-boot-progress-bar"></div>
          </div>
          <div class="sz-boot-status">Loading...</div>
        </div>`;
    }

    async #buildFrameMode(config) {
      const { folder, fps = 12, fileList } = config;
      const sortedFiles = [...fileList].sort();

      const frames = await Promise.all(
        sortedFiles.map(name => new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = `${folder}/${name}`;
        }))
      );

      if (frames.length === 0)
        return this.#buildCssFallback();

      this.#container.innerHTML = `
        <div class="sz-boot-content">
          <canvas class="sz-boot-canvas"></canvas>
          <div class="sz-boot-progress">
            <div class="sz-boot-progress-bar"></div>
          </div>
          <div class="sz-boot-status">Loading...</div>
        </div>`;

      const canvas = this.#container.querySelector('.sz-boot-canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = frames[0].width;
      canvas.height = frames[0].height;

      const frameDuration = 1000 / fps;
      let currentFrame = 0;
      let lastTimestamp = 0;

      const tick = (timestamp) => {
        if (timestamp - lastTimestamp >= frameDuration) {
          lastTimestamp = timestamp;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(frames[currentFrame], 0, 0);
          currentFrame = (currentFrame + 1) % frames.length;
        }
        this.#animationFrameId = requestAnimationFrame(tick);
      };

      this.#animationFrameId = requestAnimationFrame(tick);
    }
  }

  SZ.BootScreen = BootScreen;
})();
