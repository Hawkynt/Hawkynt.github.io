;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const SEASONS = Object.freeze({
    SPRING: 'spring',
    SUMMER: 'summer',
    AUTUMN: 'autumn',
    WINTER: 'winter'
  });

  const BONUS_STATS = Object.freeze(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);

  const CNY_DATES = Object.freeze({
    2024: '0210', 2025: '0129', 2026: '0217', 2027: '0206',
    2028: '0126', 2029: '0213', 2030: '0203', 2031: '0123',
    2032: '0211', 2033: '0131', 2034: '0219', 2035: '0208'
  });

  function _easterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
  }

  function _pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  class TimeRotation {
    #clock;

    constructor(clock) {
      this.#clock = clock || (() => new Date());
    }

    #now() {
      return this.#clock();
    }

    dailySeed() {
      const d = this.#now();
      return `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`;
    }

    weeklySeed() {
      const d = this.#now();
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const days = Math.floor((d - jan1) / 86400000);
      const week = Math.ceil((days + jan1.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${_pad2(week)}`;
    }

    monthlySeed() {
      const d = this.#now();
      return `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}`;
    }

    dailyBonusStat() {
      const d = this.#now();
      const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 86400000);
      return BONUS_STATS[dayOfYear % BONUS_STATS.length];
    }

    isHoliday() {
      const d = this.#now();
      const mm = d.getMonth() + 1;
      const dd = d.getDate();
      const mmdd = _pad2(mm) + _pad2(dd);
      const year = d.getFullYear();

      if (mmdd === '1225' || mmdd === '1226')
        return { name: 'Winter Solstice Festival', type: 'christmas' };
      if (mmdd === '1031')
        return { name: 'Feast of the Dead', type: 'halloween' };
      if (mmdd === '0101')
        return { name: 'New Year', type: 'newyear' };
      if (mmdd === '0214')
        return { name: 'Festival of Love', type: 'valentines' };

      const cny = CNY_DATES[year];
      if (cny) {
        const cnyMonth = parseInt(cny.substring(0, 2), 10);
        const cnyDay = parseInt(cny.substring(2), 10);
        const cnyDate = new Date(year, cnyMonth - 1, cnyDay);
        const diff = Math.floor((d - cnyDate) / 86400000);
        if (diff >= 0 && diff <= 2)
          return { name: 'Lunar New Year', type: 'cny' };
      }

      const easter = _easterDate(year);
      const easterDate = new Date(year, easter.month - 1, easter.day);
      const easterDiff = Math.floor((d - easterDate) / 86400000);
      if (easterDiff >= 0 && easterDiff <= 1)
        return { name: 'Spring Renewal', type: 'easter' };

      return null;
    }

    currentSeason() {
      const d = this.#now();
      const month = d.getMonth();
      if (month >= 2 && month <= 4)
        return SEASONS.SPRING;
      if (month >= 5 && month <= 7)
        return SEASONS.SUMMER;
      if (month >= 8 && month <= 10)
        return SEASONS.AUTUMN;
      return SEASONS.WINTER;
    }

    isSeasonallyAvailable(requiredSeason) {
      if (!requiredSeason)
        return true;
      return this.currentSeason() === requiredSeason;
    }
  }

  TR.TimeRotation = TimeRotation;
  TR.SEASONS = SEASONS;
})();
