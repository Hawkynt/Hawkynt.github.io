;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const { TimeRotation, SEASONS } = window.SZ.TacticalRealms;

  function clockAt(year, month, day) {
    return () => new Date(year, month - 1, day, 12, 0, 0);
  }

  describe('TimeRotation', () => {

    it('dailySeed() returns YYYY-MM-DD format', () => {
      const tr = new TimeRotation(clockAt(2024, 3, 15));
      assert.equal(tr.dailySeed(), '2024-03-15');
    });

    it('dailySeed() pads month and day', () => {
      const tr = new TimeRotation(clockAt(2024, 1, 5));
      assert.equal(tr.dailySeed(), '2024-01-05');
    });

    it('dailySeed() changes each day', () => {
      const a = new TimeRotation(clockAt(2024, 6, 10));
      const b = new TimeRotation(clockAt(2024, 6, 11));
      assert.notEqual(a.dailySeed(), b.dailySeed());
    });

    it('weeklySeed() returns YYYY-Wnn format', () => {
      const tr = new TimeRotation(clockAt(2024, 3, 15));
      const seed = tr.weeklySeed();
      assert.ok(/^\d{4}-W\d{2}$/.test(seed), `Bad format: ${seed}`);
    });

    it('weeklySeed() same for dates in same week', () => {
      const a = new TimeRotation(clockAt(2024, 3, 11));
      const b = new TimeRotation(clockAt(2024, 3, 12));
      assert.equal(a.weeklySeed(), b.weeklySeed());
    });

    it('monthlySeed() returns YYYY-MM format', () => {
      const tr = new TimeRotation(clockAt(2024, 7, 20));
      assert.equal(tr.monthlySeed(), '2024-07');
    });

    it('monthlySeed() same for all days in a month', () => {
      const a = new TimeRotation(clockAt(2024, 7, 1));
      const b = new TimeRotation(clockAt(2024, 7, 31));
      assert.equal(a.monthlySeed(), b.monthlySeed());
    });

    it('monthlySeed() differs between months', () => {
      const a = new TimeRotation(clockAt(2024, 7, 15));
      const b = new TimeRotation(clockAt(2024, 8, 15));
      assert.notEqual(a.monthlySeed(), b.monthlySeed());
    });

    it('dailyBonusStat() returns a valid stat', () => {
      const tr = new TimeRotation(clockAt(2024, 1, 1));
      const stat = tr.dailyBonusStat();
      assert.includes(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'], stat);
    });

    it('dailyBonusStat() cycles through all 6 stats', () => {
      const seen = new Set();
      for (let d = 1; d <= 6; ++d) {
        const tr = new TimeRotation(clockAt(2024, 1, d));
        seen.add(tr.dailyBonusStat());
      }
      assert.equal(seen.size, 6);
    });

    it('isHoliday() returns null for normal days', () => {
      const tr = new TimeRotation(clockAt(2024, 5, 10));
      assert.isNull(tr.isHoliday());
    });

    it('isHoliday() detects Christmas', () => {
      const tr = new TimeRotation(clockAt(2024, 12, 25));
      const h = tr.isHoliday();
      assert.ok(h);
      assert.equal(h.type, 'christmas');
    });

    it('isHoliday() detects Dec 26 as christmas', () => {
      const tr = new TimeRotation(clockAt(2024, 12, 26));
      assert.equal(tr.isHoliday().type, 'christmas');
    });

    it('isHoliday() detects Halloween', () => {
      const tr = new TimeRotation(clockAt(2024, 10, 31));
      assert.equal(tr.isHoliday().type, 'halloween');
    });

    it('isHoliday() detects New Year', () => {
      const tr = new TimeRotation(clockAt(2024, 1, 1));
      assert.equal(tr.isHoliday().type, 'newyear');
    });

    it('isHoliday() detects Valentine', () => {
      const tr = new TimeRotation(clockAt(2024, 2, 14));
      assert.equal(tr.isHoliday().type, 'valentines');
    });

    it('isHoliday() detects Chinese New Year 2025', () => {
      const tr = new TimeRotation(clockAt(2025, 1, 29));
      const h = tr.isHoliday();
      assert.ok(h);
      assert.equal(h.type, 'cny');
    });

    it('isHoliday() detects Easter 2024 (March 31)', () => {
      const tr = new TimeRotation(clockAt(2024, 3, 31));
      const h = tr.isHoliday();
      assert.ok(h);
      assert.equal(h.type, 'easter');
    });

    it('currentSeason() returns spring for March-May', () => {
      assert.equal(new TimeRotation(clockAt(2024, 3, 15)).currentSeason(), SEASONS.SPRING);
      assert.equal(new TimeRotation(clockAt(2024, 4, 15)).currentSeason(), SEASONS.SPRING);
      assert.equal(new TimeRotation(clockAt(2024, 5, 15)).currentSeason(), SEASONS.SPRING);
    });

    it('currentSeason() returns summer for June-August', () => {
      assert.equal(new TimeRotation(clockAt(2024, 6, 1)).currentSeason(), SEASONS.SUMMER);
      assert.equal(new TimeRotation(clockAt(2024, 7, 1)).currentSeason(), SEASONS.SUMMER);
      assert.equal(new TimeRotation(clockAt(2024, 8, 1)).currentSeason(), SEASONS.SUMMER);
    });

    it('currentSeason() returns autumn for September-November', () => {
      assert.equal(new TimeRotation(clockAt(2024, 9, 1)).currentSeason(), SEASONS.AUTUMN);
      assert.equal(new TimeRotation(clockAt(2024, 10, 1)).currentSeason(), SEASONS.AUTUMN);
      assert.equal(new TimeRotation(clockAt(2024, 11, 1)).currentSeason(), SEASONS.AUTUMN);
    });

    it('currentSeason() returns winter for December-February', () => {
      assert.equal(new TimeRotation(clockAt(2024, 12, 1)).currentSeason(), SEASONS.WINTER);
      assert.equal(new TimeRotation(clockAt(2024, 1, 15)).currentSeason(), SEASONS.WINTER);
      assert.equal(new TimeRotation(clockAt(2024, 2, 15)).currentSeason(), SEASONS.WINTER);
    });

    it('isSeasonallyAvailable() returns true when no season required', () => {
      const tr = new TimeRotation(clockAt(2024, 6, 1));
      assert.ok(tr.isSeasonallyAvailable(null));
      assert.ok(tr.isSeasonallyAvailable(undefined));
    });

    it('isSeasonallyAvailable() returns true when season matches', () => {
      const tr = new TimeRotation(clockAt(2024, 7, 1));
      assert.ok(tr.isSeasonallyAvailable(SEASONS.SUMMER));
    });

    it('isSeasonallyAvailable() returns false when season mismatches', () => {
      const tr = new TimeRotation(clockAt(2024, 7, 1));
      assert.ok(!tr.isSeasonallyAvailable(SEASONS.WINTER));
    });

    it('season boundary: Feb is winter, March is spring', () => {
      assert.equal(new TimeRotation(clockAt(2024, 2, 28)).currentSeason(), SEASONS.WINTER);
      assert.equal(new TimeRotation(clockAt(2024, 3, 1)).currentSeason(), SEASONS.SPRING);
    });

    it('season boundary: May is spring, June is summer', () => {
      assert.equal(new TimeRotation(clockAt(2024, 5, 31)).currentSeason(), SEASONS.SPRING);
      assert.equal(new TimeRotation(clockAt(2024, 6, 1)).currentSeason(), SEASONS.SUMMER);
    });
  });
})();
