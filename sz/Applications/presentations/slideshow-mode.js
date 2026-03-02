;(function() {
  'use strict';
  const PresentationsApp = window.PresentationsApp || (window.PresentationsApp = {});

  const SLIDE_WIDTH = 960;
  const SLIDE_HEIGHT = 540;
  const CURSOR_HIDE_DELAY = 3000;

  let _ctx = null;
  let _active = false;
  let _currentIndex = 0;
  let _overlay = null;
  let _frontLayer = null;
  let _backLayer = null;
  let _frontContainer = null;
  let _backContainer = null;
  let _blackScreen = null;
  let _whiteScreen = null;
  let _transitioning = false;
  let _autoAdvanceTimer = null;
  let _cursorTimer = null;
  let _abortController = null;
  let _subTimers = null;

  // Animation playback state
  let _animPlayer = null;
  let _animTimeline = null;

  function _getAnimationEngine() {
    return PresentationsApp.AnimationEngine ?? null;
  }

  function _getTransitionEngine() {
    return window.parent?.SZ?.TransitionEngine ?? null;
  }

  function _calcFitScale() {
    return Math.min(window.innerWidth / SLIDE_WIDTH, window.innerHeight / SLIDE_HEIGHT);
  }

  function _createSlideContainer(parent) {
    const container = document.createElement('div');
    const scale = _calcFitScale();
    container.style.cssText = `width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;transform:scale(${scale});transform-origin:center center;position:relative;overflow:hidden;`;
    parent.appendChild(container);
    return container;
  }

  function _updateContainerScales() {
    const scale = _calcFitScale();
    const css = `width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;transform:scale(${scale});transform-origin:center center;position:relative;overflow:hidden;`;
    if (_frontContainer)
      _frontContainer.style.cssText = css;
    if (_backContainer)
      _backContainer.style.cssText = css;
  }

  function _createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'slideshow-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#000;overflow:hidden;';

    const frontLayer = document.createElement('div');
    frontLayer.id = 'ss-front';
    frontLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;';

    const backLayer = document.createElement('div');
    backLayer.id = 'ss-back';
    backLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;';

    overlay.appendChild(frontLayer);
    overlay.appendChild(backLayer);

    const blackScreen = document.createElement('div');
    blackScreen.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:#000;z-index:10;display:none;';
    overlay.appendChild(blackScreen);

    const whiteScreen = document.createElement('div');
    whiteScreen.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:#fff;z-index:10;display:none;';
    overlay.appendChild(whiteScreen);

    _overlay = overlay;
    _frontLayer = frontLayer;
    _backLayer = backLayer;
    _blackScreen = blackScreen;
    _whiteScreen = whiteScreen;

    _frontContainer = _createSlideContainer(_frontLayer);
    _backContainer = _createSlideContainer(_backLayer);

    return overlay;
  }

  function _renderSlideInto(slide, container) {
    container.innerHTML = '';
    const scale = _calcFitScale();
    if (PresentationsApp.SlideRenderer)
      PresentationsApp.SlideRenderer.renderSlide(slide, container, { editable: false, scale });
  }

  function _getPresentation() {
    return _ctx?.getPresentation?.() ?? null;
  }

  function _getSlides() {
    const pres = _getPresentation();
    return pres?.slides ?? [];
  }

  // ---------------------------------------------------------------
  // Animation Player Setup
  // ---------------------------------------------------------------

  function _setupAnimationPlayer() {
    _cleanupAnimationPlayer();

    const engine = _getAnimationEngine();
    if (!engine)
      return;

    const slides = _getSlides();
    if (_currentIndex < 0 || _currentIndex >= slides.length)
      return;

    const slide = slides[_currentIndex];
    _animTimeline = engine.buildTimeline(slide);

    if (!_animTimeline.length) {
      _animPlayer = null;
      _animTimeline = null;
      return;
    }

    // Find the inner .slide-canvas inside the front container
    const canvas = _frontContainer.querySelector('.slide-canvas') || _frontContainer;
    _animPlayer = engine.createPlayer(canvas, _animTimeline);
    _animPlayer.initializeVisibility();
  }

  function _cleanupAnimationPlayer() {
    if (_animPlayer) {
      _animPlayer.reset();
      _animPlayer = null;
    }
    _animTimeline = null;
  }

  function _hasAnimationStepsPending() {
    return _animPlayer && _animPlayer.getCurrentStep() < _animPlayer.getTotalSteps();
  }

  function _playNextAnimationStep() {
    if (!_animPlayer)
      return;
    const step = _animPlayer.getCurrentStep();
    if (step < _animPlayer.getTotalSteps())
      _animPlayer.playStep(step);
  }

  // ---------------------------------------------------------------
  // Auto-advance & Cursor
  // ---------------------------------------------------------------

  function _scheduleAutoAdvance() {
    _clearAutoAdvance();
    const slides = _getSlides();
    if (_currentIndex >= slides.length)
      return;

    const slide = slides[_currentIndex];
    const interval = slide?.autoAdvance
      ? (slide.autoAdvanceInterval ?? _ctx?.autoAdvanceInterval ?? 5) * 1000
      : _ctx?.autoAdvance
        ? (_ctx.autoAdvanceInterval ?? 5) * 1000
        : 0;

    if (interval > 0)
      _autoAdvanceTimer = setTimeout(() => _navigateNext(), interval);
  }

  function _clearAutoAdvance() {
    if (_autoAdvanceTimer != null) {
      clearTimeout(_autoAdvanceTimer);
      _autoAdvanceTimer = null;
    }
  }

  function _resetCursorTimer() {
    if (!_overlay)
      return;
    _overlay.style.cursor = '';
    if (_cursorTimer != null)
      clearTimeout(_cursorTimer);
    _cursorTimer = setTimeout(() => {
      if (_overlay)
        _overlay.style.cursor = 'none';
    }, CURSOR_HIDE_DELAY);
  }

  function _clearCursorTimer() {
    if (_cursorTimer != null) {
      clearTimeout(_cursorTimer);
      _cursorTimer = null;
    }
    if (_overlay)
      _overlay.style.cursor = '';
  }

  // ---------------------------------------------------------------
  // Transition
  // ---------------------------------------------------------------

  function _fallbackCrossfade(front, back, duration) {
    back.style.opacity = '0';
    back.style.zIndex = '1';
    front.style.zIndex = '0';
    requestAnimationFrame(() => {
      back.style.transition = `opacity ${duration}s ease`;
      back.style.opacity = '1';
      front.style.transition = `opacity ${duration}s ease`;
      front.style.opacity = '0';
    });
  }

  // ---------------------------------------------------------------
  // Feature 28: Morph Transition Intelligence
  // ---------------------------------------------------------------

  /**
   * Match elements between slides using multi-strategy matching:
   * 1. Exact ID match
   * 2. Name property match
   * 3. Type + position proximity as fallback
   */
  function _matchMorphElements(fromSlide, toSlide) {
    const fromElements = fromSlide?.elements || [];
    const toElements = toSlide?.elements || [];

    const matched = [];
    const usedFrom = new Set();
    const usedTo = new Set();

    // Pass 1: Match by exact element ID
    const toById = new Map();
    for (const el of toElements)
      toById.set(el.id, el);

    for (const fromEl of fromElements) {
      const toEl = toById.get(fromEl.id);
      if (toEl) {
        matched.push({ from: fromEl, to: toEl });
        usedFrom.add(fromEl.id);
        usedTo.add(toEl.id);
      }
    }

    // Pass 2: Match by name property
    const remainingFrom = fromElements.filter(e => !usedFrom.has(e.id));
    const remainingTo = toElements.filter(e => !usedTo.has(e.id));

    const toByName = new Map();
    for (const el of remainingTo) {
      if (el.name)
        toByName.set(el.name, el);
    }

    for (const fromEl of remainingFrom) {
      if (!fromEl.name)
        continue;
      const toEl = toByName.get(fromEl.name);
      if (toEl && !usedTo.has(toEl.id)) {
        matched.push({ from: fromEl, to: toEl });
        usedFrom.add(fromEl.id);
        usedTo.add(toEl.id);
      }
    }

    // Pass 3: Match by type + position proximity
    const stillFrom = fromElements.filter(e => !usedFrom.has(e.id));
    const stillTo = toElements.filter(e => !usedTo.has(e.id));

    // Build candidates: same type, closest position
    const toPool = stillTo.map(el => ({
      el,
      cx: el.x + (el.w || 0) / 2,
      cy: el.y + (el.h || 0) / 2,
      claimed: false
    }));

    for (const fromEl of stillFrom) {
      const fromCx = fromEl.x + (fromEl.w || 0) / 2;
      const fromCy = fromEl.y + (fromEl.h || 0) / 2;
      let bestDist = Infinity;
      let bestCandidate = null;

      for (const candidate of toPool) {
        if (candidate.claimed || candidate.el.type !== fromEl.type)
          continue;
        const dx = candidate.cx - fromCx;
        const dy = candidate.cy - fromCy;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestCandidate = candidate;
        }
      }

      // Only match if within a reasonable proximity (half-slide distance)
      const MAX_MATCH_DIST_SQ = (SLIDE_WIDTH * SLIDE_WIDTH + SLIDE_HEIGHT * SLIDE_HEIGHT) * 0.25;
      if (bestCandidate && bestDist < MAX_MATCH_DIST_SQ) {
        matched.push({ from: fromEl, to: bestCandidate.el });
        usedFrom.add(fromEl.id);
        usedTo.add(bestCandidate.el.id);
        bestCandidate.claimed = true;
      }
    }

    const unmatchedFrom = fromElements.filter(e => !usedFrom.has(e.id));
    const unmatchedTo = toElements.filter(e => !usedTo.has(e.id));

    return { matched, unmatchedFrom, unmatchedTo };
  }

  /**
   * Interpolate an RGB hex color between two values
   */
  function _parseHexColor(hex) {
    if (!hex)
      return null;
    const h = hex.replace('#', '');
    if (h.length < 6)
      return null;
    return {
      r: parseInt(h.substring(0, 2), 16) || 0,
      g: parseInt(h.substring(2, 4), 16) || 0,
      b: parseInt(h.substring(4, 6), 16) || 0
    };
  }

  /**
   * Interpolate an RGB hex color between two values at a given ratio (0..1).
   * Returns the target hex color when used as a validator (ratio omitted).
   * For CSS-transitioned properties, the browser handles intermediate frames.
   */
  function _interpolateColor(fromHex, toHex, ratio) {
    if (!fromHex || !toHex || fromHex === toHex)
      return null;

    const from = _parseHexColor(fromHex);
    const to = _parseHexColor(toHex);
    if (!from || !to)
      return null;

    // If ratio provided, compute intermediate color
    if (ratio != null) {
      const t = Math.max(0, Math.min(1, ratio));
      const r = Math.round(from.r + (to.r - from.r) * t);
      const g = Math.round(from.g + (to.g - from.g) * t);
      const b = Math.round(from.b + (to.b - from.b) * t);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Without ratio, return target color for CSS transition use
    return toHex;
  }

  /**
   * Compute the shortest rotation arc between two angles
   */
  function _shortestRotationArc(fromDeg, toDeg) {
    let delta = ((toDeg - fromDeg) % 360 + 540) % 360 - 180;
    return fromDeg + delta;
  }

  function _runMorphTransition(fromSlide, toSlide, duration) {
    const { matched, unmatchedFrom, unmatchedTo } = _matchMorphElements(fromSlide, toSlide);

    // Build DOM maps for both layers
    const frontMap = {};
    for (const fe of _frontContainer.querySelectorAll('.slide-element')) {
      const eid = fe.dataset?.elementId;
      if (eid) frontMap[eid] = fe;
    }
    const backMap = {};
    for (const be of _backContainer.querySelectorAll('.slide-element')) {
      const eid = be.dataset?.elementId;
      if (eid) backMap[eid] = be;
    }

    // Front layer on top, back layer visible behind for unmatched-to elements
    _frontLayer.style.opacity = '1';
    _frontLayer.style.zIndex = '1';
    _backLayer.style.opacity = '1';
    _backLayer.style.zIndex = '0';

    // Hide matched elements in back layer (front layer will animate to their positions)
    for (const pair of matched) {
      const backDom = backMap[pair.to.id];
      if (backDom)
        backDom.style.opacity = '0';
    }

    // Hide unmatched-to elements initially, then fade them in
    for (const toEl of unmatchedTo) {
      const backDom = backMap[toEl.id];
      if (backDom) {
        backDom.style.opacity = '0';
        backDom.style.transition = `opacity ${duration}s ease-in-out`;
      }
    }

    const transitionProps = [
      'left', 'top', 'width', 'height',
      'opacity', 'transform',
      'background-color', 'border-radius',
      'font-size', 'color'
    ].map(p => `${p} ${duration}s ease-in-out`).join(', ');

    // Set initial transition properties on matched elements (no transition yet)
    for (const pair of matched) {
      const fromDom = frontMap[pair.from.id];
      if (!fromDom)
        continue;
      // Force layout computation before adding transition
      fromDom.getBoundingClientRect();
      fromDom.style.transition = transitionProps;

      // Also set transition on inner elements for color/font-size
      const innerEl = fromDom.querySelector('div');
      if (innerEl) {
        innerEl.getBoundingClientRect();
        innerEl.style.transition = `font-size ${duration}s ease-in-out, color ${duration}s ease-in-out`;
      }
    }

    // Set fade-out transition on unmatched-from elements
    for (const fromEl of unmatchedFrom) {
      const fromDom = frontMap[fromEl.id];
      if (fromDom) {
        fromDom.getBoundingClientRect();
        fromDom.style.transition = `opacity ${duration}s ease-in-out`;
      }
    }

    // Use double-RAF to ensure browser paints initial state before triggering transitions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Animate matched elements to target positions/properties
        for (const pair of matched) {
          const fromDom = frontMap[pair.from.id];
          if (!fromDom)
            continue;

          // Position & size (linear interpolation via CSS transition)
          fromDom.style.left = pair.to.x + 'px';
          fromDom.style.top = pair.to.y + 'px';
          fromDom.style.width = pair.to.w + 'px';
          fromDom.style.height = pair.to.h + 'px';

          // Opacity
          const toOpacity = pair.to.opacity ?? 1;
          const fromOpacity = pair.from.opacity ?? 1;
          if (toOpacity !== fromOpacity)
            fromDom.style.opacity = String(toOpacity);

          // Rotation -- use shortest arc
          const toRotation = pair.to.rotation ?? 0;
          const fromRotation = pair.from.rotation ?? 0;
          if (toRotation !== fromRotation) {
            const targetAngle = _shortestRotationArc(fromRotation, toRotation);
            fromDom.style.transform = `rotate(${targetAngle}deg)`;
          }

          // Fill color interpolation (for shapes)
          if (pair.from.fillColor && pair.to.fillColor && pair.from.fillColor !== pair.to.fillColor)
            fromDom.style.backgroundColor = pair.to.fillColor;

          // Background color interpolation (for textboxes)
          if (pair.from.backgroundColor && pair.to.backgroundColor && pair.from.backgroundColor !== pair.to.backgroundColor)
            fromDom.style.backgroundColor = pair.to.backgroundColor;

          // Border radius interpolation
          const fromBR = pair.from.borderRadius || 0;
          const toBR = pair.to.borderRadius || 0;
          if (fromBR !== toBR)
            fromDom.style.borderRadius = toBR + 'px';

          // Font size and color interpolation for text elements
          const innerEl = fromDom.querySelector('div');
          if (innerEl) {
            const fromFS = pair.from.fontSize || 18;
            const toFS = pair.to.fontSize || 18;
            if (fromFS !== toFS)
              innerEl.style.fontSize = toFS + 'px';

            const fromColor = pair.from.color;
            const toColor = pair.to.color;
            if (fromColor && toColor && fromColor !== toColor)
              innerEl.style.color = toColor;
          }
        }

        // Fade out unmatched-from elements
        for (const fromEl of unmatchedFrom) {
          const fromDom = frontMap[fromEl.id];
          if (fromDom)
            fromDom.style.opacity = '0';
        }

        // Fade in unmatched-to elements
        for (const toEl of unmatchedTo) {
          const backDom = backMap[toEl.id];
          if (backDom)
            backDom.style.opacity = '1';
        }
      });
    });
  }

  function _transitionTo(targetIndex, direction) {
    if (_transitioning)
      return;

    const slides = _getSlides();
    if (targetIndex < 0 || targetIndex >= slides.length)
      return;

    _transitioning = true;
    _clearAutoAdvance();
    _cleanupAnimationPlayer();

    const currentSlide = _currentIndex >= 0 && _currentIndex < slides.length ? slides[_currentIndex] : null;
    const targetSlide = slides[targetIndex];
    const transition = targetSlide?.transition;
    const transitionType = (typeof transition === 'object' ? transition?.type : transition) || 'fade';
    const duration = (typeof transition === 'object' ? transition?.duration : null) ?? 0.5;

    _renderSlideInto(targetSlide, _backContainer);

    // Feature 28: Morph transition
    if (transitionType === 'morph' && currentSlide) {
      _runMorphTransition(currentSlide, targetSlide, duration);
    } else {
      const engine = _getTransitionEngine();
      if (engine) {
        const resolved = engine.resolveTransition(transitionType);
        engine.runTransition(_frontLayer, _backLayer, resolved, duration, _subTimers);
      } else
        _fallbackCrossfade(_frontLayer, _backLayer, duration);
    }

    const finishDelay = duration * 1000 + 50;
    setTimeout(() => {
      const tmpLayer = _frontLayer;
      _frontLayer = _backLayer;
      _backLayer = tmpLayer;

      const tmpContainer = _frontContainer;
      _frontContainer = _backContainer;
      _backContainer = tmpContainer;

      _frontLayer.style.transition = '';
      _frontLayer.style.opacity = '1';
      _frontLayer.style.transform = '';
      _frontLayer.style.clipPath = '';
      _frontLayer.style.filter = '';
      _frontLayer.style.zIndex = '';
      _frontLayer.style.transformOrigin = '';

      _backLayer.style.transition = '';
      _backLayer.style.opacity = '0';
      _backLayer.style.transform = '';
      _backLayer.style.clipPath = '';
      _backLayer.style.filter = '';
      _backLayer.style.zIndex = '';
      _backLayer.style.transformOrigin = '';

      _currentIndex = targetIndex;
      _transitioning = false;

      // Setup animation player for new slide
      _setupAnimationPlayer();

      _scheduleAutoAdvance();
    }, finishDelay);
  }

  // ---------------------------------------------------------------
  // Navigation (with animation integration)
  // ---------------------------------------------------------------

  function _navigateNext() {
    // If there are pending animation steps, play next step instead of advancing
    if (_hasAnimationStepsPending()) {
      _playNextAnimationStep();
      return;
    }

    const slides = _getSlides();
    if (_currentIndex + 1 < slides.length)
      _transitionTo(_currentIndex + 1, 1);
    else if (_ctx?.loop)
      _transitionTo(0, 1);
    else
      stopSlideshow();
  }

  function _navigatePrev() {
    // Clean up any running animations when going back
    _cleanupAnimationPlayer();

    if (_currentIndex - 1 >= 0)
      _transitionTo(_currentIndex - 1, -1);
    else if (_ctx?.loop)
      _transitionTo(_getSlides().length - 1, -1);
  }

  function _navigateFirst() {
    _cleanupAnimationPlayer();
    if (_currentIndex !== 0)
      _transitionTo(0, -1);
  }

  // ---------------------------------------------------------------
  // Screen toggles
  // ---------------------------------------------------------------

  function _toggleBlack() {
    if (!_blackScreen)
      return;
    _whiteScreen.style.display = 'none';
    _blackScreen.style.display = _blackScreen.style.display === 'none' ? 'block' : 'none';
  }

  function _toggleWhite() {
    if (!_whiteScreen)
      return;
    _blackScreen.style.display = 'none';
    _whiteScreen.style.display = _whiteScreen.style.display === 'none' ? 'block' : 'none';
  }

  // ---------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------

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
      case 'End':
        e.preventDefault();
        stopSlideshow();
        break;
      case 'Home':
        e.preventDefault();
        _navigateFirst();
        break;
      case 'b':
      case 'B':
        e.preventDefault();
        _toggleBlack();
        break;
      case 'w':
      case 'W':
        e.preventDefault();
        _toggleWhite();
        break;
    }
  }

  function _handleClick(e) {
    if (e.target === _blackScreen || e.target === _whiteScreen) {
      _blackScreen.style.display = 'none';
      _whiteScreen.style.display = 'none';
      return;
    }

    // Feature 20: Action button clicks
    const actionBtn = e.target.closest('.el-action-button');
    if (actionBtn) {
      const elementId = actionBtn.dataset.elementId;
      const slides = _getSlides();
      const slide = slides[_currentIndex];
      if (slide) {
        const element = slide.elements.find(el => el.id === elementId);
        if (element && element.type === 'action-button') {
          switch (element.action) {
            case 'next': _navigateNext(); return;
            case 'prev': _navigatePrev(); return;
            case 'first': _navigateFirst(); return;
            case 'last':
              if (_currentIndex !== slides.length - 1)
                _transitionTo(slides.length - 1, 1);
              return;
            case 'end': stopSlideshow(); return;
            case 'url':
              if (element.actionUrl)
                window.open(element.actionUrl, '_blank');
              return;
          }
        }
      }
    }

    _navigateNext();
  }

  function _handleFullscreenChange() {
    if (!document.fullscreenElement && _active)
      stopSlideshow();
  }

  function _handleMouseMove() {
    _resetCursorTimer();
  }

  function _handleResize() {
    _updateContainerScales();
  }

  // ---------------------------------------------------------------
  // Fullscreen
  // ---------------------------------------------------------------

  function _tryEnterFullscreen() {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen)
        el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen)
        el.webkitRequestFullscreen();
    } catch (_) {
      // fullscreen not available
    }
  }

  function _tryExitFullscreen() {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen)
          document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen)
          document.webkitExitFullscreen();
      }
    } catch (_) {
      // fullscreen not available
    }
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  function init(ctx) {
    _ctx = ctx;
  }

  function startSlideshow(fromIndex) {
    if (_active)
      return;

    const slides = _getSlides();
    if (!slides.length)
      return;

    _active = true;
    _currentIndex = Math.max(0, Math.min(fromIndex ?? 0, slides.length - 1));
    _transitioning = false;
    _subTimers = new Set();
    _abortController = new AbortController();
    const signal = _abortController.signal;

    const overlay = _createOverlay();
    document.body.appendChild(overlay);

    _frontLayer.style.opacity = '1';
    _backLayer.style.opacity = '0';

    _renderSlideInto(slides[_currentIndex], _frontContainer);

    // Setup animation player for first slide
    _setupAnimationPlayer();

    document.addEventListener('keydown', _handleKeyDown, { signal });
    overlay.addEventListener('click', _handleClick, { signal });
    document.addEventListener('fullscreenchange', _handleFullscreenChange, { signal });
    document.addEventListener('webkitfullscreenchange', _handleFullscreenChange, { signal });
    overlay.addEventListener('mousemove', _handleMouseMove, { signal });
    window.addEventListener('resize', _handleResize, { signal });

    _tryEnterFullscreen();
    _resetCursorTimer();
    _scheduleAutoAdvance();
  }

  function stopSlideshow() {
    if (!_active)
      return;

    _active = false;
    _transitioning = false;

    _clearAutoAdvance();
    _clearCursorTimer();
    _cleanupAnimationPlayer();

    const engine = _getTransitionEngine();
    if (engine)
      engine.cancelPending(_subTimers);

    if (_subTimers) {
      for (const id of _subTimers)
        clearInterval(id);
      _subTimers.clear();
      _subTimers = null;
    }

    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }

    if (_overlay && _overlay.parentNode) {
      _overlay.parentNode.removeChild(_overlay);
      _overlay = null;
    }

    _frontLayer = null;
    _backLayer = null;
    _frontContainer = null;
    _backContainer = null;
    _blackScreen = null;
    _whiteScreen = null;

    _tryExitFullscreen();

    if (_ctx?.onExit)
      _ctx.onExit();
  }

  function isActive() {
    return _active;
  }

  PresentationsApp.SlideshowMode = Object.freeze({
    init,
    startSlideshow,
    stopSlideshow,
    isActive,
  });
})();
