;(function() {
  'use strict';
  const PP = window.PresentationsApp || (window.PresentationsApp = {});

  // ===============================================================
  // Animation ID generation
  // ===============================================================

  let _animIdCounter = 0;
  const _generateAnimId = () => 'anim-' + Date.now() + '-' + (++_animIdCounter);

  // ===============================================================
  // Animation Presets
  // ===============================================================

  const PRESETS = {
    // -- Entrance --
    'appear': { category: 'entrance', label: 'Appear', defaultDuration: 0 },
    'fade-in': { category: 'entrance', label: 'Fade In', defaultDuration: 500 },
    'fly-in': { category: 'entrance', label: 'Fly In', defaultDuration: 500 },
    'wipe': { category: 'entrance', label: 'Wipe', defaultDuration: 500 },
    'zoom-in': { category: 'entrance', label: 'Zoom In', defaultDuration: 500 },
    'bounce': { category: 'entrance', label: 'Bounce', defaultDuration: 700 },
    'float-in': { category: 'entrance', label: 'Float In', defaultDuration: 600 },

    // -- Emphasis --
    'pulse': { category: 'emphasis', label: 'Pulse', defaultDuration: 1000 },
    'grow-shrink': { category: 'emphasis', label: 'Grow/Shrink', defaultDuration: 1000 },
    'spin': { category: 'emphasis', label: 'Spin', defaultDuration: 1000 },
    'color-change': { category: 'emphasis', label: 'Color Change', defaultDuration: 1500 },
    'transparency': { category: 'emphasis', label: 'Transparency', defaultDuration: 1000 },

    // -- Exit --
    'disappear': { category: 'exit', label: 'Disappear', defaultDuration: 0 },
    'fade-out': { category: 'exit', label: 'Fade Out', defaultDuration: 500 },
    'fly-out': { category: 'exit', label: 'Fly Out', defaultDuration: 500 },
    'shrink': { category: 'exit', label: 'Shrink', defaultDuration: 500 },
    'zoom-out': { category: 'exit', label: 'Zoom Out', defaultDuration: 500 },

    // -- Motion Path --
    'motion-line': { category: 'motion-path', label: 'Line', defaultDuration: 1000 },
    'motion-arc': { category: 'motion-path', label: 'Arc', defaultDuration: 1000 },
    'custom-path': { category: 'motion-path', label: 'Custom Path', defaultDuration: 2000 },
  };

  // ===============================================================
  // Effect Options Map
  // ===============================================================

  const EFFECT_OPTIONS = {
    'fly-in': { directions: ['from-bottom', 'from-top', 'from-left', 'from-right', 'from-bottom-left', 'from-top-right'] },
    'fly-out': { directions: ['to-bottom', 'to-top', 'to-left', 'to-right'] },
    'wipe': { directions: ['from-bottom', 'from-top', 'from-left', 'from-right'] },
    'zoom-in': { options: ['center', 'slide-center'] },
    'zoom-out': { options: ['center', 'slide-center'] },
    'spin': { options: ['clockwise', 'counter-clockwise'] },
    'bounce': { options: ['bounce', 'no-bounce'] },
    'grow-shrink': { options: ['both', 'horizontal', 'vertical'] }
  };

  function getEffectOptions(effectName) {
    return EFFECT_OPTIONS[effectName] || null;
  }

  // ===============================================================
  // CSS Keyframe Generation
  // ===============================================================

  function generateKeyframes(anim) {
    const name = 'pp-anim-' + anim.id;
    let dur = anim.duration ?? PRESETS[anim.effect]?.defaultDuration ?? 500;
    const delay = anim.delay ?? 0;
    let keyframes = '';
    let animCSS = '';

    switch (anim.effect) {

      // -- Entrance effects --

      case 'appear':
        dur = 1; // instant — 1ms minimum
        keyframes = '@keyframes ' + name + ' { from { visibility: visible; } to { visibility: visible; } }';
        animCSS = name + ' 1ms linear ' + delay + 'ms both';
        break;

      case 'fade-in':
        keyframes = '@keyframes ' + name + ' { from { opacity: 0; } to { opacity: 1; } }';
        animCSS = name + ' ' + dur + 'ms ease ' + delay + 'ms both';
        break;

      case 'fly-in': {
        const dir = (anim.effectOptions && anim.effectOptions.direction) || anim.direction || 'from-bottom';
        const translations = {
          'from-left': 'translateX(-120%)',
          'from-right': 'translateX(120%)',
          'from-top': 'translateY(-120%)',
          'from-bottom': 'translateY(120%)',
          'from-bottom-left': 'translate(-120%, 120%)',
          'from-top-right': 'translate(120%, -120%)'
        };
        const t = translations[dir] || 'translateY(120%)';
        keyframes = '@keyframes ' + name + ' { from { transform: ' + t + '; opacity: 0; } to { transform: translate(0, 0); opacity: 1; } }';
        animCSS = name + ' ' + dur + 'ms ease-out ' + delay + 'ms both';
        break;
      }

      case 'wipe': {
        const dir = (anim.effectOptions && anim.effectOptions.direction) || anim.direction || 'from-left';
        const clips = {
          'from-left': { from: 'inset(0 100% 0 0)', to: 'inset(0 0 0 0)' },
          'from-right': { from: 'inset(0 0 0 100%)', to: 'inset(0 0 0 0)' },
          'from-top': { from: 'inset(0 0 100% 0)', to: 'inset(0 0 0 0)' },
          'from-bottom': { from: 'inset(100% 0 0 0)', to: 'inset(0 0 0 0)' }
        };
        const clip = clips[dir] || clips['from-left'];
        keyframes = '@keyframes ' + name + ' { from { clip-path: ' + clip.from + '; opacity: 1; } to { clip-path: ' + clip.to + '; opacity: 1; } }';
        animCSS = name + ' ' + dur + 'ms ease-in-out ' + delay + 'ms both';
        break;
      }

      case 'zoom-in': {
        const opt = (anim.effectOptions && anim.effectOptions.option) || 'center';
        const origin = opt === 'slide-center' ? 'transform-origin: 50% 50%; ' : '';
        keyframes = '@keyframes ' + name + ' { from { transform: scale(0); opacity: 0; ' + origin + '} to { transform: scale(1); opacity: 1; ' + origin + '} }';
        animCSS = name + ' ' + dur + 'ms ease-out ' + delay + 'ms both';
        break;
      }

      case 'bounce': {
        const opt = (anim.effectOptions && anim.effectOptions.option) || 'bounce';
        if (opt === 'no-bounce') {
          keyframes = '@keyframes ' + name + ' { '
            + '0% { transform: scale(0); opacity: 0; } '
            + '100% { transform: scale(1); opacity: 1; } }';
        } else {
          keyframes = '@keyframes ' + name + ' { '
            + '0% { transform: scale(0); opacity: 0; } '
            + '40% { transform: scale(1.15); opacity: 1; } '
            + '60% { transform: scale(0.9); } '
            + '75% { transform: scale(1.05); } '
            + '90% { transform: scale(0.98); } '
            + '100% { transform: scale(1); opacity: 1; } }';
        }
        animCSS = name + ' ' + dur + 'ms ease-out ' + delay + 'ms both';
        break;
      }

      case 'float-in':
        keyframes = '@keyframes ' + name + ' { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }';
        animCSS = name + ' ' + dur + 'ms ease-out ' + delay + 'ms both';
        break;

      // -- Emphasis effects --

      case 'pulse':
        keyframes = '@keyframes ' + name + ' { '
          + '0% { transform: scale(1); } '
          + '25% { transform: scale(1.1); } '
          + '50% { transform: scale(1); } '
          + '75% { transform: scale(1.1); } '
          + '100% { transform: scale(1); } }';
        animCSS = name + ' ' + dur + 'ms ease-in-out ' + delay + 'ms both';
        break;

      case 'grow-shrink': {
        const opt = (anim.effectOptions && anim.effectOptions.option) || 'both';
        let scaleFrom, scaleTo;
        if (opt === 'horizontal') {
          scaleFrom = 'scaleX(1)';
          scaleTo = 'scaleX(1.3)';
        } else if (opt === 'vertical') {
          scaleFrom = 'scaleY(1)';
          scaleTo = 'scaleY(1.3)';
        } else {
          scaleFrom = 'scale(1)';
          scaleTo = 'scale(1.3)';
        }
        keyframes = '@keyframes ' + name + ' { '
          + '0% { transform: ' + scaleFrom + '; } '
          + '50% { transform: ' + scaleTo + '; } '
          + '100% { transform: ' + scaleFrom + '; } }';
        animCSS = name + ' ' + dur + 'ms ease-in-out ' + delay + 'ms both';
        break;
      }

      case 'spin': {
        const opt = (anim.effectOptions && anim.effectOptions.option) || 'clockwise';
        const deg = opt === 'counter-clockwise' ? '-360deg' : '360deg';
        keyframes = '@keyframes ' + name + ' { from { transform: rotate(0deg); } to { transform: rotate(' + deg + '); } }';
        animCSS = name + ' ' + dur + 'ms ease-in-out ' + delay + 'ms both';
        break;
      }

      case 'color-change':
        keyframes = '@keyframes ' + name + ' { '
          + '0% { filter: hue-rotate(0deg); } '
          + '50% { filter: hue-rotate(180deg); } '
          + '100% { filter: hue-rotate(360deg); } }';
        animCSS = name + ' ' + dur + 'ms linear ' + delay + 'ms both';
        break;

      case 'transparency':
        keyframes = '@keyframes ' + name + ' { '
          + '0% { opacity: 1; } '
          + '50% { opacity: 0.3; } '
          + '100% { opacity: 1; } }';
        animCSS = name + ' ' + dur + 'ms ease-in-out ' + delay + 'ms both';
        break;

      // -- Exit effects --

      case 'disappear':
        dur = 1; // instant — 1ms minimum
        keyframes = '@keyframes ' + name + ' { from { visibility: visible; opacity: 1; } to { visibility: hidden; opacity: 0; } }';
        animCSS = name + ' 1ms linear ' + delay + 'ms both';
        break;

      case 'fade-out':
        keyframes = '@keyframes ' + name + ' { from { opacity: 1; } to { opacity: 0; } }';
        animCSS = name + ' ' + dur + 'ms ease ' + delay + 'ms both';
        break;

      case 'fly-out': {
        const dir = (anim.effectOptions && anim.effectOptions.direction) || anim.direction || 'to-bottom';
        const translations = {
          'to-left': 'translateX(-120%)',
          'to-right': 'translateX(120%)',
          'to-top': 'translateY(-120%)',
          'to-bottom': 'translateY(120%)'
        };
        const t = translations[dir] || 'translateY(120%)';
        keyframes = '@keyframes ' + name + ' { from { transform: translate(0, 0); opacity: 1; } to { transform: ' + t + '; opacity: 0; } }';
        animCSS = name + ' ' + dur + 'ms ease-in ' + delay + 'ms both';
        break;
      }

      case 'shrink':
        keyframes = '@keyframes ' + name + ' { from { transform: scale(1); opacity: 1; } to { transform: scale(0.1); opacity: 0; } }';
        animCSS = name + ' ' + dur + 'ms ease-in ' + delay + 'ms both';
        break;

      case 'zoom-out': {
        const opt = (anim.effectOptions && anim.effectOptions.option) || 'center';
        const origin = opt === 'slide-center' ? 'transform-origin: 50% 50%; ' : '';
        keyframes = '@keyframes ' + name + ' { from { transform: scale(1); opacity: 1; ' + origin + '} to { transform: scale(0); opacity: 0; ' + origin + '} }';
        animCSS = name + ' ' + dur + 'ms ease-in ' + delay + 'ms both';
        break;
      }

      // -- Motion Path effects --

      case 'motion-line': {
        const dir = anim.direction || 'right';
        const dist = anim.distance || 200;
        const vectors = {
          'left': 'translateX(-' + dist + 'px)',
          'right': 'translateX(' + dist + 'px)',
          'up': 'translateY(-' + dist + 'px)',
          'down': 'translateY(' + dist + 'px)',
          'up-right': 'translate(' + dist + 'px, -' + dist + 'px)',
          'down-right': 'translate(' + dist + 'px, ' + dist + 'px)',
          'up-left': 'translate(-' + dist + 'px, -' + dist + 'px)',
          'down-left': 'translate(-' + dist + 'px, ' + dist + 'px)'
        };
        const v = vectors[dir] || vectors['right'];
        keyframes = '@keyframes ' + name + ' { from { transform: translate(0,0); } to { transform: ' + v + '; } }';
        animCSS = name + ' ' + dur + 'ms ease-in-out ' + delay + 'ms both';
        break;
      }

      case 'motion-arc': {
        const dir = anim.direction || 'right';
        const dist = anim.distance || 200;
        const half = dist / 2;
        let offsets;
        switch (dir) {
          case 'left':
            offsets = { mid: 'translate(-' + half + 'px, -' + half + 'px)', end: 'translate(-' + dist + 'px, 0px)' };
            break;
          case 'up':
            offsets = { mid: 'translate(' + half + 'px, -' + half + 'px)', end: 'translate(0px, -' + dist + 'px)' };
            break;
          case 'down':
            offsets = { mid: 'translate(-' + half + 'px, ' + half + 'px)', end: 'translate(0px, ' + dist + 'px)' };
            break;
          default: // right
            offsets = { mid: 'translate(' + half + 'px, -' + half + 'px)', end: 'translate(' + dist + 'px, 0px)' };
            break;
        }
        keyframes = '@keyframes ' + name + ' { 0% { transform: translate(0,0); } 50% { transform: ' + offsets.mid + '; } 100% { transform: ' + offsets.end + '; } }';
        animCSS = name + ' ' + dur + 'ms ease-in-out ' + delay + 'ms both';
        break;
      }

      case 'custom-path': {
        const points = anim.motionPath || [];
        if (points.length >= 2) {
          const steps = points.length - 1;
          const kfParts = [];
          for (let i = 0; i <= steps; ++i) {
            const pct = Math.round((i / steps) * 100);
            kfParts.push(pct + '% { transform: translate(' + points[i].x + 'px, ' + points[i].y + 'px); }');
          }
          keyframes = '@keyframes ' + name + ' { ' + kfParts.join(' ') + ' }';
        } else {
          keyframes = '@keyframes ' + name + ' { from { transform: translate(0,0); } to { transform: translate(0,0); } }';
        }
        animCSS = name + ' ' + dur + 'ms ease-in-out ' + delay + 'ms both';
        break;
      }

      default:
        // Fallback: simple fade
        keyframes = '@keyframes ' + name + ' { from { opacity: 0; } to { opacity: 1; } }';
        animCSS = name + ' ' + dur + 'ms ease ' + delay + 'ms both';
        break;
    }

    return { keyframes, animCSS, name, duration: dur, delay };
  }

  // ===============================================================
  // Animation CRUD operations on elements
  // ===============================================================

  function addAnimation(element, effect, opts) {
    if (!element)
      return null;
    if (!element.animations)
      element.animations = [];

    const preset = PRESETS[effect];
    if (!preset)
      return null;

    const anim = {
      id: _generateAnimId(),
      category: preset.category,
      effect: effect,
      trigger: opts?.trigger ?? 'on-click',
      duration: opts?.duration ?? preset.defaultDuration,
      delay: opts?.delay ?? 0,
      direction: opts?.direction ?? null,
      distance: opts?.distance ?? 200,
      repeatCount: opts?.repeatCount ?? 1,
      autoReverse: opts?.autoReverse ?? false,
      motionPath: opts?.motionPath ?? null
    };

    element.animations.push(anim);
    return anim;
  }

  function removeAnimation(element, animId) {
    if (!element?.animations)
      return;
    const idx = element.animations.findIndex(a => a.id === animId);
    if (idx >= 0)
      element.animations.splice(idx, 1);
  }

  function reorderAnimation(element, animId, direction) {
    if (!element?.animations)
      return;
    const idx = element.animations.findIndex(a => a.id === animId);
    if (idx < 0)
      return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= element.animations.length)
      return;
    const temp = element.animations[idx];
    element.animations[idx] = element.animations[newIdx];
    element.animations[newIdx] = temp;
  }

  function getAnimationsForSlide(slide) {
    if (!slide?.elements)
      return [];
    const result = [];
    for (const el of slide.elements) {
      if (el.animations && el.animations.length) {
        for (const anim of el.animations)
          result.push({ elementId: el.id, elementName: _getElementName(el), anim });
      }
    }
    return result;
  }

  function _getElementName(el) {
    if (!el)
      return 'Unknown';
    switch (el.type) {
      case 'textbox': {
        const text = (el.content || '').replace(/<[^>]*>/g, '').trim();
        return text.length > 20 ? text.substring(0, 20) + '...' : (text || 'Text Box');
      }
      case 'image': return 'Image';
      case 'shape': return 'Shape (' + (el.shapeType || 'rect') + ')';
      case 'table': return 'Table';
      case 'group': return 'Group';
      default: return 'Element';
    }
  }

  // ===============================================================
  // Timeline Builder
  // ===============================================================

  function buildTimeline(slide) {
    const allAnims = getAnimationsForSlide(slide);
    if (!allAnims.length)
      return [];

    const steps = [];
    let currentStep = null;
    let runningTime = 0;

    for (const entry of allAnims) {
      const { elementId, anim } = entry;
      const trigger = anim.trigger ?? 'on-click';
      const dur = anim.duration ?? PRESETS[anim.effect]?.defaultDuration ?? 500;
      const delay = anim.delay ?? 0;

      switch (trigger) {
        case 'on-click':
          // Start a new step
          currentStep = { step: steps.length, animations: [] };
          steps.push(currentStep);
          runningTime = 0;
          currentStep.animations.push({
            anim,
            elementId,
            startTime: delay,
            duration: dur
          });
          runningTime = delay + dur;
          break;

        case 'with-previous':
          // Merge into current step at its own delay
          if (!currentStep) {
            currentStep = { step: steps.length, animations: [] };
            steps.push(currentStep);
            runningTime = 0;
          }
          currentStep.animations.push({
            anim,
            elementId,
            startTime: delay,
            duration: dur
          });
          runningTime = Math.max(runningTime, delay + dur);
          break;

        case 'after-previous':
          // Merge into current step starting after the previous animation
          if (!currentStep) {
            currentStep = { step: steps.length, animations: [] };
            steps.push(currentStep);
            runningTime = 0;
          }
          currentStep.animations.push({
            anim,
            elementId,
            startTime: runningTime + delay,
            duration: dur
          });
          runningTime = runningTime + delay + dur;
          break;
      }
    }

    return steps;
  }

  // ===============================================================
  // Animation Player
  // ===============================================================

  function createPlayer(slideContainer, timeline) {
    let _currentStep = 0;
    let _playing = false;
    let _styleEl = null;
    let _playTimers = [];

    // Inject a <style> element for keyframes
    function _ensureStyleElement() {
      if (_styleEl)
        return;
      _styleEl = document.createElement('style');
      _styleEl.id = 'pp-animation-styles';
      (slideContainer.ownerDocument || document).head.appendChild(_styleEl);
    }

    // Find element DOM node inside the slide container
    function _findElementDom(elementId) {
      return slideContainer.querySelector('[data-element-id="' + elementId + '"]');
    }

    // Hide entrance-animated elements before their step
    function initializeVisibility() {
      for (const step of timeline) {
        for (const entry of step.animations) {
          const preset = PRESETS[entry.anim.effect];
          if (preset && preset.category === 'entrance') {
            const dom = _findElementDom(entry.elementId);
            if (dom) {
              dom.style.visibility = 'hidden';
              dom.style.opacity = '0';
            }
          }
        }
      }
    }

    function playStep(stepIndex) {
      if (stepIndex < 0 || stepIndex >= timeline.length)
        return;

      _playing = true;
      _ensureStyleElement();

      const step = timeline[stepIndex];
      let cssRules = '';
      const animEntries = []; // track for post-animation cleanup

      for (const entry of step.animations) {
        const { anim, elementId, startTime } = entry;
        const preset = PRESETS[anim.effect];
        if (!preset)
          continue;

        const dom = _findElementDom(elementId);
        if (!dom)
          continue;

        // Override the delay on the anim to incorporate timeline startTime
        const adjustedAnim = Object.assign({}, anim, { delay: startTime });
        const gen = generateKeyframes(adjustedAnim);

        cssRules += gen.keyframes + '\n';
        animEntries.push({ dom, anim, gen, preset, startTime });

        // For entrance: make visible right before animation starts
        if (preset.category === 'entrance') {
          const timer = setTimeout(() => {
            dom.style.visibility = 'visible';
            // Reset opacity so CSS animation can take over
            dom.style.opacity = '';
          }, startTime);
          _playTimers.push(timer);
        }

        // Apply animation CSS
        const applyTimer = setTimeout(() => {
          dom.style.animation = gen.animCSS;

          // Repeat count
          if (anim.repeatCount && anim.repeatCount > 1)
            dom.style.animationIterationCount = String(anim.repeatCount);

          // Auto-reverse
          if (anim.autoReverse)
            dom.style.animationDirection = 'alternate';

          // For exit: hide after animation completes (use resolved duration from generator)
          if (preset.category === 'exit') {
            const hideDelay = gen.duration + gen.delay;
            const hideTimer = setTimeout(() => {
              dom.style.visibility = 'hidden';
              dom.style.opacity = '0';
            }, hideDelay);
            _playTimers.push(hideTimer);
          }
        }, 0);
        _playTimers.push(applyTimer);
      }

      // Append new keyframes (accumulate — names are unique; fill-mode:both needs
      // earlier keyframes to stay defined so held final states are preserved)
      _styleEl.textContent += cssRules;

      // Calculate max animation time for this step
      let maxTime = 0;
      for (const entry of step.animations) {
        const end = entry.startTime + entry.duration;
        if (end > maxTime)
          maxTime = end;
      }

      // After all animations in this step complete, persist final states as
      // inline styles and clear animation CSS so we no longer depend on keyframes
      const cleanupTimer = setTimeout(() => {
        for (const { dom, anim, gen, preset } of animEntries) {
          const cs = dom.ownerDocument.defaultView?.getComputedStyle(dom);
          if (cs) {
            // Persist transform and opacity from the animation's final state
            const t = cs.transform;
            const o = cs.opacity;
            dom.style.animation = '';
            dom.style.animationIterationCount = '';
            dom.style.animationDirection = '';
            if (t && t !== 'none')
              dom.style.transform = t;
            if (preset.category === 'entrance')
              dom.style.opacity = o;
          } else
            dom.style.animation = '';
        }
        _playing = false;
        ++_currentStep;
      }, maxTime + 50);
      _playTimers.push(cleanupTimer);
    }

    function reset() {
      // Clear all timers
      for (const t of _playTimers)
        clearTimeout(t);
      _playTimers = [];

      // Remove animation styles
      if (_styleEl && _styleEl.parentNode) {
        _styleEl.parentNode.removeChild(_styleEl);
        _styleEl = null;
      }

      // Reset element visibility and animation
      const elements = slideContainer.querySelectorAll('.slide-element');
      for (const el of elements) {
        el.style.animation = '';
        el.style.animationIterationCount = '';
        el.style.animationDirection = '';
        el.style.visibility = '';
        el.style.opacity = '';
        el.style.transform = '';
        el.style.clipPath = '';
        el.style.filter = '';
      }

      _currentStep = 0;
      _playing = false;
    }

    function getCurrentStep() {
      return _currentStep;
    }

    function getTotalSteps() {
      return timeline.length;
    }

    function isPlaying() {
      return _playing;
    }

    return Object.freeze({
      playStep,
      reset,
      getCurrentStep,
      getTotalSteps,
      isPlaying,
      initializeVisibility
    });
  }

  // ===============================================================
  // Initialize
  // ===============================================================

  function init() {
    // Placeholder for future initialization
  }

  // ===============================================================
  // Export
  // ===============================================================

  PP.AnimationEngine = Object.freeze({
    init,
    PRESETS,
    EFFECT_OPTIONS,
    generateKeyframes,
    buildTimeline,
    createPlayer,
    addAnimation,
    removeAnimation,
    reorderAnimation,
    getAnimationsForSlide,
    getEffectOptions
  });

})();
