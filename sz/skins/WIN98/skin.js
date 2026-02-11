;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const skins = SZ.skins || (SZ.skins = {});

  const BASE = 'skins/WIN98';

  skins['WIN98'] = {
    name: 'Windows 98',
    author: 'Matt Davis',
    email: 'davim6a0@elon.edu',
    generator: 'BuilderBlinds ver 0.9.24, Build 48  - http://welcome.to/BuilderBlinds',
    editorNotes: 'For Windows 95 users who like 98\'s nifty titlebar gradient.',
    wbVersion: 0,
    basePath: BASE,

    personality: {
      usestran: 0,
      buttoncount: 5,
      textalignment: 0,
      textshift: 17,
      textshiftvert: 2,
      textrightclip: 50,
      menubar: `${BASE}/MENU.BMP`,
      menur: 0,
      menug: 0,
      menub: 128,
      activetextr: 255,
      activetextg: 255,
      activetextb: 255,
      inactivetextr: 192,
      inactivetextg: 192,
      inactivetextb: 192,
      menutextr: 0,
      menutextg: 0,
      menutextb: 0,
      top: `${BASE}/TOP.BMP`,
      left: `${BASE}/LEFT.BMP`,
      right: `${BASE}/RIGHT.BMP`,
      bottom: `${BASE}/BOTTOM.BMP`,
      toptopheight: 4,
      topbotheight: 4,
      lefttopheight: 4,
      leftbotheight: 4,
      righttopheight: 4,
      rightbotheight: 4,
      bottomtopheight: 4,
      bottombotheight: 4,
      topstretch: 1,
      leftstretch: 1,
      rightstretch: 1,
      bottomstretch: 1,
      anirate: 0,
      topframe: 2,
      leftframe: 2,
      rightframe: 2,
      bottomframe: 2,
      tripleimages: 0,
      soundenabled: 0,
      tilemenu: 1,
    },

    buttons: {
    },

    titleButtons: [
      { image: `${BASE}/CLOSE.BMP`, align: 1, xcoord: 22, ycoord: 6, action: 0 },
      { image: `${BASE}/MAX.BMP`, align: 1, xcoord: 40, ycoord: 6, action: 1, visibility: 4 },
      { image: `${BASE}/MIN.BMP`, align: 1, xcoord: 56, ycoord: 6, action: 2 },
      { image: `${BASE}/REST.BMP`, align: 1, xcoord: 40, ycoord: 6, action: 1, visibility: 3 },
      { align: 0, xcoord: 6, ycoord: 5, action: 11 },
    ],

    comboButton: {
    },

    startButton: {},

    colors: {
      activeBorder: [192, 192, 192],
      appWorkspace: [128, 128, 128],
      buttonFace: [192, 192, 192],
      highlight: [0, 0, 128],
      highlightText: [255, 255, 255],
      inactiveBorder: [192, 192, 192],
      menu: [192, 192, 192],
      menuText: [0, 0, 0],
      titleText: [255, 255, 255],
      windowText: [0, 0, 0],
    },

    fonts: {
    },
  };
})();
