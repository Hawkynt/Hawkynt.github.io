;(function() {
  'use strict';

  // Biomes and the landing site: every site gets one, picked by its seed.
  // Owns: NS.biomes and these state fields:
  //   G.site
  // Reads: util

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { makeRng } = NS.util;

  /* ======================================================================
     BIOMES -- every landing site gets one, picked by the site's seed
     ====================================================================== */

  // sky*: gradient top -> horizon by day, night and dusk; ranges: far, mid and
  // near mountain colours [top, foot]; ore: spawn multipliers per resource;
  // weather: how often each kind of weather happens here
  const BIOMES = {
    rocky: {
      name: 'Rocky Badlands', shape: 'ridge', plant: 'grass', decor: 'ringed',
      plantColors: ['#3f8a70', '#5ab08e', '#2c6a54'],
      skyDay: ['#2c5ca8', '#5c94d4', '#a8c8e8', '#e8c8b0'], skyNight: ['#02030c', '#0a0f2e', '#1a1846', '#4a2a5e'], skyDusk: ['#1c2460', '#5a3a80', '#c0607a', '#ffa868'],
      nebula: ['70,60,180', '40,140,170', '150,50,150'],
      ranges: [
        { day: ['#9a92c4', '#7a72a8'], night: ['#3c2c62', '#2a2456'] },
        { day: ['#6e6496', '#544a7e'], night: ['#251d48', '#17163a'] },
        { day: ['#4a3e66', '#382e52'], night: ['#14122c', '#0c0b20'] }],
      rim: ['rgba(255,240,230,0.45)', 'rgba(170,140,255,0.4)'],
      ground: { day: ['#9a7488', '#7a5a6c', '#56404e', '#2e2030'], night: ['#4a3048', '#38243a', '#24172a', '#140c18'], pebble: [150, 110, 140], gems: ['#5ad0ff', '#c070ff', '#60f0b0'], edge: '#ffbedc' },
      weather: { rain: 1, snow: 1, blizzard: 0.8, storm: 1, meteor: 1.3 },
      ore: { iron: 1.3, tin: 1.2, titanium: 1.3 }
    },
    desert: {
      name: 'Dune Sea', shape: 'mesa', plant: 'cactus', decor: 'none',
      plantColors: ['#4a8a3a', '#6ab050', '#2e5e26'],
      skyDay: ['#2a6cc0', '#6aaee6', '#c8e2f2', '#f8e2b0'], skyNight: ['#04040c', '#141028', '#2a1c38', '#5a3a40'], skyDusk: ['#2a1e50', '#7a3a5a', '#e0703a', '#ffd070'],
      nebula: ['150,90,60', '120,60,120', '60,60,140'],
      ranges: [
        { day: ['#e8b484', '#d49a68'], night: ['#4a2e38', '#3a2430'] },
        { day: ['#c8804c', '#b06a3c'], night: ['#331e26', '#28161e'] },
        { day: ['#9a5630', '#824628'], night: ['#1e1014', '#160a0e'] }],
      rim: ['rgba(255,240,200,0.55)', 'rgba(255,170,120,0.3)'],
      ground: { day: ['#f0cc8a', '#d8aa68', '#b07e44', '#6a4a26'], night: ['#5a4234', '#463226', '#2e2018', '#18100a'], pebble: [180, 140, 90], gems: ['#ffd060', '#ff9a40', '#ffe8a0'], edge: '#fff0c0' },
      weather: { rain: 0.25, snow: 0.05, blizzard: 0, storm: 0.6, meteor: 1.6 },
      ore: { gold: 1.7, copper: 1.3, quartz: 1.3, water: 0.5 }
    },
    ice: {
      name: 'Frozen Shelf', shape: 'peaks', plant: 'icicle', decor: 'aurora',
      plantColors: ['#bfe8ff', '#e8f8ff', '#7ac0e8'],
      skyDay: ['#3a74c4', '#7ab4e8', '#c8e6f8', '#eef8ff'], skyNight: ['#01040c', '#061428', '#0e2840', '#1e4058'], skyDusk: ['#1a2a6a', '#5a4a9a', '#c080c0', '#ffc8d0'],
      nebula: ['40,140,170', '60,100,200', '80,180,160'],
      ranges: [
        { day: ['#dceaf8', '#b4c8e0'], night: ['#30405e', '#22304c'] },
        { day: ['#a8bcd8', '#8aa0c0'], night: ['#1e2a44', '#141e36'] },
        { day: ['#7a90b0', '#62789a'], night: ['#121a2e', '#0a1020'] }],
      rim: ['rgba(255,255,255,0.7)', 'rgba(160,220,255,0.45)'],
      ground: { day: ['#f0f8ff', '#d0e2f2', '#98b0cc', '#5a6a88'], night: ['#3a4a6a', '#2a3854', '#1a243a', '#0c1222'], pebble: [170, 190, 220], gems: ['#9ae0ff', '#e0f8ff', '#7ab8ff'], edge: '#ffffff' },
      weather: { rain: 0.2, snow: 2.6, blizzard: 2.6, storm: 0.25, meteor: 1 },
      ore: { water: 2, silver: 1.4, sapphire: 1.5 }
    },
    jungle: {
      name: 'Alien Jungle', shape: 'hills', plant: 'fern', decor: 'giant',
      plantColors: ['#2aa060', '#5ad080', '#1a7048'],
      skyDay: ['#1a7a8a', '#4ab0a8', '#a8e0c0', '#e8f4c8'], skyNight: ['#010806', '#04160f', '#0c2a1e', '#1e4030'], skyDusk: ['#123048', '#3a5a6a', '#d0806a', '#f0d080'],
      nebula: ['40,160,120', '30,120,160', '120,180,80'],
      ranges: [
        { day: ['#5aa88a', '#46907a'], night: ['#16382e', '#102c24'] },
        { day: ['#3a845e', '#2c6c4c'], night: ['#0e2a1e', '#0a2018'] },
        { day: ['#22603c', '#184c2e'], night: ['#08180e', '#041008'] }],
      rim: ['rgba(230,255,200,0.45)', 'rgba(120,255,180,0.3)'],
      ground: { day: ['#5a8a3a', '#46702e', '#2e4c20', '#162a12'], night: ['#1e3422', '#16281a', '#0e1a12', '#060e08'], pebble: [90, 130, 80], gems: ['#7aff9a', '#ffd040', '#ff7ad0'], edge: '#d0ffb0' },
      weather: { rain: 2.4, snow: 0.15, blizzard: 0.05, storm: 1.8, meteor: 0.8 },
      ore: { emerald: 1.8, copper: 1.4, coal: 1.3, uranium: 1.4 }
    },
    volcanic: {
      name: 'Ashen Caldera', shape: 'volcano', plant: 'ember', decor: 'none',
      plantColors: ['#ff7a20', '#ffd060', '#7a2a10'],
      skyDay: ['#5a4a52', '#8a6a66', '#c09078', '#f0b080'], skyNight: ['#060102', '#1a0606', '#360c0a', '#6a1c10'], skyDusk: ['#2a1420', '#6a2a2a', '#d0502a', '#ffa040'],
      nebula: ['180,60,40', '140,40,60', '200,100,40'],
      ranges: [
        { day: ['#7a6a6a', '#665656'], night: ['#2a1414', '#201010'] },
        { day: ['#5a4646', '#4a3838'], night: ['#1c0c0c', '#160808'] },
        { day: ['#3c2c2c', '#2e2020'], night: ['#100606', '#0a0404'] }],
      rim: ['rgba(255,200,160,0.4)', 'rgba(255,90,40,0.55)'],
      ground: { day: ['#5a4644', '#463634', '#2e2220', '#181010'], night: ['#2e1616', '#241010', '#180a0a', '#0c0404'], pebble: [90, 70, 70], gems: ['#ff6a20', '#ffb040', '#ff3a20'], edge: '#ff9a6a' },
      weather: { rain: 0.5, snow: 0.2, blizzard: 0.1, storm: 1.3, meteor: 2.2 },
      ore: { redstone: 1.8, ruby: 1.5, coal: 1.5, opal: 1.6 }
    },
    crystal: {
      name: 'Crystal Fields', shape: 'spires', plant: 'shard', decor: 'shattered',
      plantColors: ['#a0a0ff', '#e0c0ff', '#60e0ff'],
      skyDay: ['#4a3ab0', '#8a7ae0', '#d0c0f0', '#f8e0f4'], skyNight: ['#03020c', '#100828', '#24104a', '#4a2068'], skyDusk: ['#22186a', '#5a3aa0', '#c060c0', '#ffb0e0'],
      nebula: ['120,80,220', '200,80,200', '60,160,220'],
      ranges: [
        { day: ['#aab0f0', '#8a90d8'], night: ['#2a2a62', '#202052'] },
        { day: ['#7a7ccc', '#6062b0'], night: ['#1a1a48', '#12123a'] },
        { day: ['#4e4a96', '#3c387c'], night: ['#0e0c2a', '#08061c'] }],
      rim: ['rgba(240,230,255,0.6)', 'rgba(180,140,255,0.5)'],
      ground: { day: ['#8a80c0', '#6a60a0', '#463e76', '#221c44'], night: ['#2c2452', '#221c44', '#161032', '#0a081a'], pebble: [130, 120, 190], gems: ['#c0a0ff', '#80e8ff', '#ffa0e0'], edge: '#e8d8ff' },
      weather: { rain: 0.8, snow: 0.8, blizzard: 0.5, storm: 0.9, meteor: 1.6 },
      ore: { quartz: 2, diamond: 1.6, amethyst: 1.6, cobalt: 1.3 }
    }
  };
  const BIOME_KEYS = Object.keys(BIOMES);

  // The landing site: index counts relocations, the seed drives biome, terrain and mine
  G.site = newSite(0, (Math.random() * 0x7fffffff) | 0);

  function newSite(index, seed) {
    const rng = makeRng(seed ^ 0x2545f491);
    return { index, seed, biome: BIOME_KEYS[Math.floor(rng() * BIOME_KEYS.length)] };
  }

  function currentBiome() {
    return BIOMES[G.site.biome] || BIOMES.rocky;
  }

  NS.biomes = { BIOMES, BIOME_KEYS, newSite, currentBiome };
})();
