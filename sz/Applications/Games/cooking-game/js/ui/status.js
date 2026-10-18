;(function() {
  'use strict';

  /* The status bar, the window title and the high-score table. Reads G
     (screen, day, money) and the save; writes only the DOM. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { STATE_PAUSED, STATE_DAY_OVER } = NS.C;
  const { User32 } = NS.view;
  const { countStars, loadHighScores } = NS.persist;
  const { isMenuState } = NS.rules;

  const SCREEN_LABEL = {
    title: 'Title', career: 'Career', upgrades: 'Kitchen', recipes: 'Recipe Book', help: 'Help'
  };

  function updateStatus() {
    const dayEl = document.getElementById('statusDay');
    const moneyEl = document.getElementById('statusMoney');
    const servedEl = document.getElementById('statusCustomers');
    if (isMenuState(G.state)) {
      if (dayEl) dayEl.textContent = 'Screen: ' + SCREEN_LABEL[G.state];
      if (moneyEl) moneyEl.textContent = `Coins: $${G.save.coins}`;
      if (servedEl) servedEl.textContent = `Stars: ${countStars()} / 90`;
      return;
    }
    if (dayEl) dayEl.textContent = `Day: ${G.dayInfo ? G.dayInfo.id : SZ.KitchenData.CAREER[0].id}`;
    if (moneyEl) moneyEl.textContent = `Tips: $${G.earned}`;
    if (servedEl) servedEl.textContent = `Served: ${G.served}`;
  }

  function showHighScores() {
    const scores = loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    if (tbody) {
      tbody.innerHTML = scores.map((s, i) =>
        `<tr><td>${i + 1}</td><td>${s.day}</td><td>$${s.money}</td></tr>`
      ).join('');
    }
  }

  function updateWindowTitle() {
    const suffix = G.state === STATE_PAUSED ? ' — Paused'
      : G.state === STATE_DAY_OVER ? ' — Day Complete'
      : isMenuState(G.state) ? ''
      : G.dayInfo ? ` — Day ${G.dayInfo.id}` : '';
    const title = `Cooking Game${suffix}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  NS.status = { updateWindowTitle, updateStatus, showHighScores };

})();
