/*
 * Career flow: cup unlocks, cup start and next race, final standings, cup points
 * and trophies, best laps and the credit reward of a finished race. Writes G.save,
 * G.raceCup, G.currentVariant and the last-result fields the results screens show.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { NUM_OPPONENTS, CREDITS_1ST, CREDITS_2ND, CREDITS_3RD, CREDITS_4TH, REWARD_PERFECT_START,
    REWARD_MEGA_TURBO, REWARD_HIT, REWARD_CLEAN_RACE } = NS.constants;
  const { AI_PERSONALITIES, CUPS, CUP_POINTS, CUP_RACES, TROPHY_RANK, trackVariant } = NS.defs;
  const { writeSave } = NS.save;
  const RaceSetup = NS.module('raceSetup');

  function isCupUnlocked(cupIndex) {
    if (cupIndex <= 0) return true;
    if (cupIndex >= CUPS.length) return false;
    return !!G.save.trophies[CUPS[cupIndex - 1].id];
  }

  /* The same three personalities drive every race of one cup */
  function pickCupPersonalities() {
    const shuffled = AI_PERSONALITIES.slice();
    for (let i = shuffled.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    return shuffled.slice(0, NUM_OPPONENTS).map(p => p.name);
  }

  function setCupRace(cupIndex, raceIndex) {
    const race = CUPS[cupIndex].races[raceIndex];
    G.raceCup = cupIndex;
    G.currentTrackIndex = race[0];
    G.currentVariant = trackVariant(race[0], race[1]);
  }

  function startCup(cupIndex) {
    if (cupIndex < 0 || cupIndex >= CUPS.length || !isCupUnlocked(cupIndex)) return false;
    G.save.cupProgress = { cup: cupIndex, race: 0, points: {}, aiNames: pickCupPersonalities() };
    setCupRace(cupIndex, 0);
    writeSave();
    RaceSetup.resetGame();
    return true;
  }

  function nextCupRace() {
    const progress = G.save.cupProgress;
    if (!progress) return false;
    if (!CUPS[progress.cup] || progress.race >= CUP_RACES) {
      G.save.cupProgress = null;
      writeSave();
      return false;
    }
    setCupRace(progress.cup, progress.race);
    RaceSetup.resetGame();
    return true;
  }

  /* All four racers in finishing order: finished first by finish time, then by distance raced */
  function finalStandings() {
    const entries = [{ name: 'player', finished: true, finishTime: G.raceTime, dist: G.ship.ts.dist }];
    for (let i = 0; i < G.opponents.length; ++i) {
      const ai = G.opponents[i];
      entries.push({ name: ai.name, finished: ai.finished, finishTime: ai.finishTime, dist: ai.ts.dist });
    }
    entries.sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished && a.finishTime !== b.finishTime) return a.finishTime - b.finishTime;
      return b.dist - a.dist;
    });
    return entries;
  }

  function awardCupPoints(playerPlace) {
    const progress = G.save.cupProgress;
    if (!progress) return;
    const cup = CUPS[progress.cup];
    if (!cup) {
      G.save.cupProgress = null;
      return;
    }
    if (!progress.points) progress.points = {};
    const points = progress.points;
    const playerPts = CUP_POINTS[Math.max(0, Math.min(CUP_POINTS.length - 1, playerPlace - 1))];
    points.player = (points.player || 0) + playerPts;
    const standings = finalStandings();
    G.lastRacePoints = { player: playerPts };
    for (let i = 0; i < standings.length; ++i) {
      if (standings[i].name === 'player') continue;
      points[standings[i].name] = (points[standings[i].name] || 0) + CUP_POINTS[i];
      G.lastRacePoints[standings[i].name] = CUP_POINTS[i];
    }

    ++progress.race;
    if (G.save.unlockedTracks.indexOf(G.currentVariant.key) < 0)
      G.save.unlockedTracks.push(G.currentVariant.key);

    if (progress.race >= CUP_RACES) {
      const table = Object.keys(points).map(name => ({ name: name, points: points[name] }));
      table.sort((a, b) => b.points - a.points || (a.name === 'player' ? -1 : 1));
      let rank = 0;
      while (rank < table.length && table[rank].name !== 'player')
        ++rank;
      const trophy = rank === 0 ? 'gold' : rank === 1 ? 'silver' : rank === 2 ? 'bronze' : null;
      const held = G.save.trophies[cup.id];
      if (trophy && (!held || TROPHY_RANK[trophy] > TROPHY_RANK[held]))
        G.save.trophies[cup.id] = trophy;
      G.lastCupResult = { cup: cup.id, standings: table, trophy: trophy };
      G.save.cupProgress = null;
      G.raceCup = null;
      if (trophy === 'gold')
        setTimeout(() => SZ.GameAudio.play('win'), 600);
    }
  }

  function recordBestLap(lapTime) {
    if (!(lapTime > 0)) return;
    const key = G.currentVariant.key;
    const held = G.save.bestLaps[key];
    if (held === undefined || lapTime < held)
      G.save.bestLaps[key] = lapTime;
  }

  /* Credits for one finished race: placement plus the bonuses earned on the way */
  function awardRaceReward(place) {
    const cupFactor = G.raceCup !== null ? CUPS[G.raceCup].reward : 1;
    const base = Math.round(([CREDITS_1ST, CREDITS_2ND, CREDITS_3RD, CREDITS_4TH][place - 1] || CREDITS_4TH) * cupFactor);
    const bonuses = [];
    if (G.bonusPerfectStart) bonuses.push(['Perfect start', REWARD_PERFECT_START]);
    if (G.bonusMegaTurbos > 0) bonuses.push(['Mega turbos', G.bonusMegaTurbos * REWARD_MEGA_TURBO]);
    if (G.bonusHitsLanded > 0) bonuses.push(['Hits landed', G.bonusHitsLanded * REWARD_HIT]);
    if (G.bonusCleanRace) bonuses.push(['Clean race', REWARD_CLEAN_RACE]);

    let total = base;
    for (let i = 0; i < bonuses.length; ++i)
      total += bonuses[i][1];

    G.lastRaceReward = { base: base, bonuses: bonuses, total: total };
    G.save.credits += total;
    G.credits = G.save.credits;
    ++G.save.stats.races;
    if (place === 1)
      ++G.save.stats.wins;
    return G.lastRaceReward;
  }

  Object.assign(NS.module('career'), {
    isCupUnlocked, startCup, nextCupRace, finalStandings, awardCupPoints, recordBestLap, awardRaceReward
  });
})();
