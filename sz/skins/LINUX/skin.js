;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const skins = SZ.skins || (SZ.skins = {});

  const BASE = 'skins/LINUX';

  skins['LINUX'] = {
    name: 'Linux-KDE',
    author: 'Sven Langenkamp',
    email: 'AceOfGuitar@gmx.de',
    url: 'www.DieSpackenmeister.de',
    generator: 'BuilderBlinds ver 0.14.30, Build 54  - http://welcome.to/BuilderBlinds',
    editorNotes: 'Make with original KDE screenshots!',
    wbVersion: 0,
    basePath: BASE,

    personality: {
      buttoncount: 5,
      textalignment: 0,
      textshift: 28,
      textshiftvert: 4,
      textrightclip: 70,
      textonbottom: '0',
      frontstring: '',
      endstring: '',
      textbackground: '0',
      txtbackleft: '2',
      txtbackright: '2',
      menur: 192,
      menug: 192,
      menub: 192,
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
      toptopheight: 25,
      topbotheight: 68,
      lefttopheight: 24,
      leftbotheight: 24,
      righttopheight: 24,
      rightbotheight: 24,
      bottomtopheight: 24,
      bottombotheight: 24,
      topstretch: 0,
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
      menubar: `${BASE}/MENU.BMP`,
      tileleftmenu: 2,
      tilerightmenu: 2,
      menulefttile: 3,
      menuborders: `${BASE}/MENUBORD.BMP`,
    },

    buttons: {
      checkbutton: `${BASE}/CHECKBOX.BMP`,
      bitmap: `${BASE}/BUTTON.BMP`,
      topheight: 2,
      bottomheight: 2,
      leftwidth: 2,
      rightwidth: 2,
    },

    titleButtons: [
      { image: `${BASE}/MIN.BMP`, align: 1, xcoord: 66, ycoord: 4, action: 2, visibility: 14 },
      { image: `${BASE}/MAX.BMP`, align: 1, xcoord: 46, ycoord: 4, action: 1, visibility: 4 },
      { image: `${BASE}/MAX2.BMP`, align: 1, xcoord: 46, ycoord: 4, action: 1, visibility: 3 },
      { image: `${BASE}/CLOSE.BMP`, align: 1, xcoord: 22, ycoord: 4, action: 0 },
      { align: 0, xcoord: 6, ycoord: 4, action: 11 },
    ],

    comboButton: {
    },

    startButton: { image: `${BASE}/START.BMP` },

    colors: {
    },

    fonts: {
    },
  };
})();
