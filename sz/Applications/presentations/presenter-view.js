;(function() {
  'use strict';

  const PresentationsApp = window.PresentationsApp || (window.PresentationsApp = {});

  const SLIDE_WIDTH = 960;
  const SLIDE_HEIGHT = 540;

  let _ctx = null;
  let _active = false;
  let _presenterWindow = null;
  let _audienceWindow = null;
  let _currentIndex = 0;
  let _startTime = 0;
  let _timerInterval = null;
  let _overlay = null;
  let _abortController = null;

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  function init(ctx) {
    _ctx = ctx;
  }

  function _getPresentation() {
    return _ctx?.getPresentation?.() ?? null;
  }

  function _getSlides() {
    const pres = _getPresentation();
    return pres?.slides ?? [];
  }

  // -----------------------------------------------------------------------
  // Audience Window
  // -----------------------------------------------------------------------

  function _openAudienceWindow() {
    const w = window.open('', 'sz-slideshow-audience', 'width=960,height=540,menubar=no,toolbar=no,status=no');
    if (!w)
      return null;

    w.document.title = 'Slideshow';
    w.document.body.style.cssText = 'margin:0;padding:0;background:#000;overflow:hidden;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;';

    const container = w.document.createElement('div');
    container.id = 'audience-slide';
    container.style.cssText = 'position:relative;overflow:hidden;background:#fff;';
    w.document.body.appendChild(container);

    // Update scale on resize
    const updateScale = () => {
      const scaleW = w.innerWidth / SLIDE_WIDTH;
      const scaleH = w.innerHeight / SLIDE_HEIGHT;
      const scale = Math.min(scaleW, scaleH);
      container.style.width = SLIDE_WIDTH + 'px';
      container.style.height = SLIDE_HEIGHT + 'px';
      container.style.transform = 'scale(' + scale + ')';
      container.style.transformOrigin = 'center center';
    };

    w.addEventListener('resize', updateScale);
    updateScale();

    return w;
  }

  function _renderSlideInAudienceWindow(slideIndex) {
    if (!_audienceWindow || _audienceWindow.closed)
      return;

    const slides = _getSlides();
    if (slideIndex < 0 || slideIndex >= slides.length)
      return;

    const container = _audienceWindow.document.getElementById('audience-slide');
    if (!container)
      return;

    const slide = slides[slideIndex];
    if (PresentationsApp.SlideRenderer) {
      const scaleW = _audienceWindow.innerWidth / SLIDE_WIDTH;
      const scaleH = _audienceWindow.innerHeight / SLIDE_HEIGHT;
      const scale = Math.min(scaleW, scaleH);
      PresentationsApp.SlideRenderer.renderSlide(slide, container, { editable: false, scale: 1 });
      container.style.width = SLIDE_WIDTH + 'px';
      container.style.height = SLIDE_HEIGHT + 'px';
      container.style.transform = 'scale(' + scale + ')';
      container.style.transformOrigin = 'center center';
    }
  }

  // -----------------------------------------------------------------------
  // Presenter Overlay
  // -----------------------------------------------------------------------

  function _createPresenterOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'presenter-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#2d2d2d;color:#fff;font-family:Segoe UI,sans-serif;display:grid;grid-template-columns:2fr 1fr;grid-template-rows:1fr auto auto;overflow:hidden;';

    // Current slide area
    const currentArea = document.createElement('div');
    currentArea.style.cssText = 'padding:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;';
    const currentContainer = document.createElement('div');
    currentContainer.id = 'pv-current-slide';
    currentContainer.style.cssText = 'background:#fff;position:relative;overflow:hidden;';
    currentArea.appendChild(currentContainer);
    overlay.appendChild(currentArea);

    // Right panel: next slide + notes
    const rightPanel = document.createElement('div');
    rightPanel.style.cssText = 'display:flex;flex-direction:column;border-left:1px solid #444;overflow:hidden;';

    // Next slide preview
    const nextLabel = document.createElement('div');
    nextLabel.style.cssText = 'padding:8px 12px;font-size:11px;color:#aaa;font-weight:bold;';
    nextLabel.textContent = 'Next Slide';
    rightPanel.appendChild(nextLabel);

    const nextContainer = document.createElement('div');
    nextContainer.id = 'pv-next-slide';
    nextContainer.style.cssText = 'background:#fff;margin:0 12px;aspect-ratio:16/9;overflow:hidden;position:relative;flex-shrink:0;';
    rightPanel.appendChild(nextContainer);

    // Speaker notes
    const notesLabel = document.createElement('div');
    notesLabel.style.cssText = 'padding:8px 12px 4px;font-size:11px;color:#aaa;font-weight:bold;';
    notesLabel.textContent = 'Speaker Notes';
    rightPanel.appendChild(notesLabel);

    const notesArea = document.createElement('div');
    notesArea.id = 'pv-notes';
    notesArea.style.cssText = 'flex:1;overflow-y:auto;padding:4px 12px 12px;font-size:14px;line-height:1.5;color:#ddd;white-space:pre-wrap;';
    rightPanel.appendChild(notesArea);

    overlay.appendChild(rightPanel);

    // Bottom bar: timer, slide count, controls
    const bottomBar = document.createElement('div');
    bottomBar.style.cssText = 'grid-column:1/-1;padding:8px 16px;background:#1a1a1a;display:flex;align-items:center;gap:16px;border-top:1px solid #444;';

    const timerEl = document.createElement('div');
    timerEl.id = 'pv-timer';
    timerEl.style.cssText = 'font-size:20px;font-family:Consolas,monospace;min-width:80px;';
    timerEl.textContent = '00:00:00';
    bottomBar.appendChild(timerEl);

    const slideCountEl = document.createElement('div');
    slideCountEl.id = 'pv-slide-count';
    slideCountEl.style.cssText = 'font-size:14px;color:#aaa;';
    bottomBar.appendChild(slideCountEl);

    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    bottomBar.appendChild(spacer);

    const btnStyle = 'padding:6px 16px;border:1px solid #666;border-radius:3px;background:#3a3a3a;color:#fff;cursor:pointer;font-size:12px;';

    const prevBtn = document.createElement('button');
    prevBtn.id = 'pv-prev';
    prevBtn.style.cssText = btnStyle;
    prevBtn.textContent = 'Previous';
    bottomBar.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.id = 'pv-next';
    nextBtn.style.cssText = btnStyle;
    nextBtn.textContent = 'Next';
    bottomBar.appendChild(nextBtn);

    const endBtn = document.createElement('button');
    endBtn.id = 'pv-end';
    endBtn.style.cssText = btnStyle + 'background:#cc3333;border-color:#aa2222;';
    endBtn.textContent = 'End Show';
    bottomBar.appendChild(endBtn);

    overlay.appendChild(bottomBar);

    return overlay;
  }

  function _renderPresenterView() {
    const slides = _getSlides();
    if (!slides.length)
      return;

    // Current slide
    const currentContainer = document.getElementById('pv-current-slide');
    if (currentContainer && PresentationsApp.SlideRenderer) {
      const parentW = currentContainer.parentElement.clientWidth - 24;
      const parentH = currentContainer.parentElement.clientHeight - 24;
      const scale = Math.min(parentW / SLIDE_WIDTH, parentH / SLIDE_HEIGHT, 1);
      currentContainer.style.width = (SLIDE_WIDTH * scale) + 'px';
      currentContainer.style.height = (SLIDE_HEIGHT * scale) + 'px';
      PresentationsApp.SlideRenderer.renderSlide(slides[_currentIndex], currentContainer, { editable: false, scale: scale });
    }

    // Next slide preview
    const nextContainer = document.getElementById('pv-next-slide');
    if (nextContainer && PresentationsApp.SlideRenderer) {
      if (_currentIndex + 1 < slides.length) {
        const thumbScale = nextContainer.offsetWidth ? nextContainer.offsetWidth / SLIDE_WIDTH : 0.2;
        PresentationsApp.SlideRenderer.renderSlide(slides[_currentIndex + 1], nextContainer, { editable: false, scale: thumbScale });
      } else {
        nextContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:12px;">End of presentation</div>';
      }
    }

    // Speaker notes
    const notesArea = document.getElementById('pv-notes');
    if (notesArea)
      notesArea.textContent = slides[_currentIndex].notes || '(No notes for this slide)';

    // Slide count
    const slideCountEl = document.getElementById('pv-slide-count');
    if (slideCountEl)
      slideCountEl.textContent = 'Slide ' + (_currentIndex + 1) + ' of ' + slides.length;
  }

  // -----------------------------------------------------------------------
  // Timer
  // -----------------------------------------------------------------------

  function _startTimer() {
    _startTime = Date.now();
    _timerInterval = setInterval(() => {
      const elapsed = Date.now() - _startTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const timerEl = document.getElementById('pv-timer');
      if (timerEl)
        timerEl.textContent = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }, 1000);
  }

  function _stopTimer() {
    if (_timerInterval != null) {
      clearInterval(_timerInterval);
      _timerInterval = null;
    }
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  function _navigateNext() {
    const slides = _getSlides();
    if (_currentIndex + 1 < slides.length) {
      ++_currentIndex;
      _renderPresenterView();
      _renderSlideInAudienceWindow(_currentIndex);
    }
  }

  function _navigatePrev() {
    if (_currentIndex > 0) {
      --_currentIndex;
      _renderPresenterView();
      _renderSlideInAudienceWindow(_currentIndex);
    }
  }

  // -----------------------------------------------------------------------
  // Event Handlers
  // -----------------------------------------------------------------------

  function _handleKeyDown(e) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
      case 'Enter':
      case 'PageDown':
        e.preventDefault();
        _navigateNext();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'Backspace':
      case 'PageUp':
        e.preventDefault();
        _navigatePrev();
        break;
      case 'Escape':
        e.preventDefault();
        stop();
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  function start(fromIndex) {
    if (_active)
      return;

    const slides = _getSlides();
    if (!slides.length)
      return;

    _active = true;
    _currentIndex = Math.max(0, Math.min(fromIndex ?? 0, slides.length - 1));
    _abortController = new AbortController();
    const signal = _abortController.signal;

    // Open audience window
    _audienceWindow = _openAudienceWindow();

    // Create presenter overlay in main window
    _overlay = _createPresenterOverlay();
    document.body.appendChild(_overlay);

    // Wire controls
    const prevBtn = document.getElementById('pv-prev');
    const nextBtn = document.getElementById('pv-next');
    const endBtn = document.getElementById('pv-end');

    if (prevBtn) prevBtn.addEventListener('click', _navigatePrev, { signal });
    if (nextBtn) nextBtn.addEventListener('click', _navigateNext, { signal });
    if (endBtn) endBtn.addEventListener('click', stop, { signal });

    document.addEventListener('keydown', _handleKeyDown, { signal });

    // Monitor audience window close
    const pollClosed = setInterval(() => {
      if (_audienceWindow && _audienceWindow.closed)
        stop();
    }, 500);
    signal.addEventListener('abort', () => clearInterval(pollClosed));

    // Render initial state
    _renderPresenterView();
    _renderSlideInAudienceWindow(_currentIndex);
    _startTimer();
  }

  function stop() {
    if (!_active)
      return;

    _active = false;
    _stopTimer();

    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }

    if (_overlay && _overlay.parentNode) {
      _overlay.parentNode.removeChild(_overlay);
      _overlay = null;
    }

    if (_audienceWindow && !_audienceWindow.closed) {
      _audienceWindow.close();
      _audienceWindow = null;
    }

    if (_ctx?.onExit)
      _ctx.onExit();
  }

  function isActive() {
    return _active;
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------
  PresentationsApp.PresenterView = Object.freeze({
    init,
    start,
    stop,
    isActive
  });

})();
