'use strict';

/* The desktop's start menu, with the mouse on a normal screen and with a finger on a small touch
   screen: it opens, All Programs lists the categories, a long category's programs show in full
   (in columns where the screen is short), resting the mouse at the top or bottom edge of a list
   that overflows scrolls it, and a finger can open, scroll and pick without the menu closing
   underneath it. */
exports.ns = null;
exports.game = 'desktop';

const menuState = () => `(function(){
  const m = document.getElementById('sz-start-menu'), f = document.querySelector('.sz-start-flyout');
  const left = document.querySelector('.sz-start-left');
  const r = f && f.getBoundingClientRect();
  return { open: !!m && m.classList.contains('open'), flyout: !!f && f.classList.contains('visible'),
    flyoutRect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
    flyoutScroll: f ? { top: f.scrollTop, left: f.scrollLeft, sh: f.scrollHeight, ch: f.clientHeight, sw: f.scrollWidth, cw: f.clientWidth } : null,
    leftScroll: left ? { top: left.scrollTop, sh: left.scrollHeight, ch: left.clientHeight } : null,
    items: f ? f.querySelectorAll('.sz-menu-item').length : 0, vw: innerWidth, vh: innerHeight };
})()`;

/* the centre of the first element matching selector (and text), in page pixels */
function centre(page, selector, text) {
  return page.eval((sel, txt) => {
    const el = Array.from(document.querySelectorAll(sel)).find(e => !txt || e.textContent.indexOf(txt) >= 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  }, selector, text);
}

async function biggestCategory(page) {
  return page.eval(() => {
    const cats = Array.from(document.querySelectorAll('.sz-menu-category'));
    return cats.length ? cats.map(c => c.textContent.replace(/[▶📁]/gu, '').trim()) : [];
  });
}

exports.run = async (t) => {
  const page = t.page;
  await t.openDesktop();

  /* ---- mouse on the normal screen ---- */
  let p = await centre(page, '#sz-start-button');
  await page.click(p.x, p.y);
  await t.wait(400);
  t.check('mouse: Start opens the menu', (await page.eval(menuState())).open);
  p = await centre(page, '.sz-all-programs');
  await page.click(p.x, p.y);
  await t.wait(300);
  const cats = await biggestCategory(page);
  t.check('mouse: All Programs lists the categories', cats.length > 3, cats);
  p = await centre(page, '.sz-menu-category', 'Games');
  await page.mouseMove(p.x, p.y);
  await t.wait(400);
  let s = await page.eval(menuState());
  await t.shot('01-mouse-games');
  t.check('mouse: hovering Games shows its programs', s.flyout && s.items > 10, s);
  t.check('mouse: every program fits on screen without scrolling, in columns if needed', s.flyoutScroll.sh <= s.flyoutScroll.ch + 1 && s.flyoutRect.y >= 0 && s.flyoutRect.y + s.flyoutRect.h <= s.vh, s);
  await page.click(5, 5);
  await t.wait(300);

  /* ---- mouse on a short screen: the lists overflow and scroll at the edges ---- */
  await page.windowBounds(900, 470);
  await t.openDesktop();
  p = await centre(page, '#sz-start-button');
  await page.click(p.x, p.y);
  await t.wait(400);
  p = await centre(page, '.sz-all-programs');
  await page.click(p.x, p.y);
  await t.wait(300);
  s = await page.eval(menuState());
  await t.shot('02-short-all-programs');
  if (s.leftScroll.sh > s.leftScroll.ch + 4) {
    const col = await centre(page, '.sz-start-left');
    await page.mouseMove(col.x, col.bottom - 4);
    await t.wait(900);
    const after = await page.eval(menuState());
    t.check('mouse: resting at the bottom edge of an overflowing list scrolls it', after.leftScroll.top > 0, after.leftScroll);
    await page.mouseMove(col.x, col.top + 4);
    await t.wait(1500);
    const back = await page.eval(menuState());
    t.check('mouse: resting at the top edge scrolls it back', back.leftScroll.top < after.leftScroll.top, back.leftScroll);
  } else t.check('the short screen makes the category list overflow', false, s.leftScroll);
  await page.windowBounds(1280, 800);

  /* ---- finger on a small phone ---- */
  await page.touchScreen(360, 580);
  await t.openDesktop();
  p = await centre(page, '#sz-start-button');
  await page.tap(p.x, p.y);
  await t.wait(500);
  s = await page.eval(menuState());
  t.check('touch: a tap on Start opens the menu', s.open, s);
  await t.wait(1200);
  t.check('touch: and it stays open', (await page.eval(menuState())).open);
  await t.shot('03-touch-open');
  p = await centre(page, '.sz-all-programs');
  if (p) await page.tap(p.x, p.y);
  await t.wait(500);
  s = await page.eval(menuState());
  t.check('touch: All Programs keeps the menu open', s.open, s);
  p = await centre(page, '.sz-menu-category', 'Games');
  if (p) await page.tap(p.x, p.y);
  await t.wait(600);
  s = await page.eval(menuState());
  await t.shot('04-touch-games');
  t.check('touch: a tap on Games shows its programs and keeps the menu open', s.open && s.flyout && s.items > 10, s);
  t.check('touch: the programs fit the phone screen', s.flyoutRect && s.flyoutRect.x >= 0 && s.flyoutRect.x + s.flyoutRect.w <= s.vw + 1 && s.flyoutRect.y >= 0, s);
  t.check('touch: on the short phone the programs use columns', s.flyoutScroll && s.flyoutScroll.sh <= s.flyoutScroll.ch + 1 || s.flyoutScroll && s.flyoutScroll.sw > s.flyoutScroll.cw, s.flyoutScroll);
  if (s.flyoutRect) {
    const fr = s.flyoutRect;
    await page.swipe(fr.x + fr.w / 2, fr.y + fr.h * 0.7, fr.x + fr.w / 2 - (s.flyoutScroll.sw > s.flyoutScroll.cw ? 150 : 0), fr.y + fr.h * 0.7 - (s.flyoutScroll.sw > s.flyoutScroll.cw ? 0 : 150));
    await t.wait(500);
    s = await page.eval(menuState());
    t.check('touch: swiping the programs keeps the menu open', s.open && s.flyout, s);
    await t.shot('05-touch-swiped');
  }
  /* emulated fingers do not make scroll gestures: scroll the columns as a swipe would */
  await page.eval('(function(){ const f = document.querySelector(".sz-start-flyout"); f.scrollLeft = f.scrollWidth; f.scrollTop = f.scrollHeight; })()');
  await t.wait(200);
  const item = await centre(page, '.sz-start-flyout .sz-menu-item', 'Tetris');
  if (item) {
    await page.tap(item.x, item.y);
    await t.wait(2500);
    const opened = await page.eval('Array.from(document.querySelectorAll("iframe")).some(f => /tetris/.test(f.src))');
    t.check('touch: tapping a program opens it', opened);
    await t.shot('06-touch-opened');
  } else t.check('touch: Tetris is in the Games list', false);
  await page.touchScreen();
};
