;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const skins = SZ.skins || (SZ.skins = {});

  const BASE = 'skins/MACOSXSERVER';

  skins['MACOSXSERVER'] = {
    name: 'MacOSXServer',
    author: 'Damien Guard',
    email: 'damien@envytech.co.uk',
    url: 'www.envytech.co.uk',
    editorNotes: 'The new dark-look Mac OS X Server/Rhapsody theme',
    wbVersion: 0,
    basePath: BASE,

    personality: {
      buttoncount: 3,
      usestran: 0,
      textalignment: 1,
      textshift: 17,
      textrightclip: 28,
      textbackground: '1',
      textback: 'MacOSXServer\\TextBack.bmp',
      txtbackleft: '4',
      txtbackright: '4',
      frontstring: '',
      endstring: '',
      menubar: `${BASE}/MENU.BMP`,
      tileleftmenu: 1,
      tilerightmenu: 1,
      rollupsize: 23,
      tripleimages: 0,
      top: `${BASE}/TOP.BMP`,
      left: `${BASE}/LEFT.BMP`,
      right: `${BASE}/RIGHT.BMP`,
      bottom: `${BASE}/BOTTOM.BMP`,
      anirate: 0,
      topframe: 2,
      leftframe: 2,
      rightframe: 2,
      bottomframe: 2,
      toptopheight: 17,
      topbotheight: 48,
      lefttopheight: 22,
      leftbotheight: 23,
      righttopheight: 22,
      rightbotheight: 23,
      bottomtopheight: 16,
      bottombotheight: 16,
      menur: 100,
      menug: 100,
      menub: 100,
      activetextr: 0,
      activetextg: 0,
      activetextb: 0,
      inactivetextr: 128,
      inactivetextg: 128,
      inactivetextb: 128,
      menutextr: 0,
      menutextg: 0,
      menutextb: 0,
    },

    buttons: {
      checkbutton: `${BASE}/CHECKBOX.BMP`,
      radiobutton: `${BASE}/RADIOBUTTON.BMP`,
      bitmap: `${BASE}/PUSHBUTTON.BMP`,
      topheight: 8,
      bottomheight: 8,
      leftwidth: 8,
      rightwidth: 17,
    },

    titleButtons: [
      { image: `${BASE}/CLOSE.BMP`, align: 0, xcoord: 4, ycoord: 4, action: 0, visibility: 0 },
      { image: `${BASE}/MAXIMIZE.BMP`, align: 1, xcoord: 33, ycoord: 4, action: 1, visibility: 20 },
      { image: `${BASE}/MINIMIZE.BMP`, align: 1, xcoord: 18, ycoord: 4, action: 2, visibility: 22 },
    ],

    comboButton: {
    },

    startButton: {},

    colors: {
      background: [0, 128, 128],
      appWorkspace: [137, 137, 137],
      window: [255, 255, 255],
      windowText: [0, 0, 0],
      menu: [206, 206, 206],
      menuText: [0, 0, 0],
      activeTitle: [0, 0, 128],
      inactiveTitle: [137, 137, 137],
      titleText: [255, 255, 255],
      activeBorder: [206, 206, 206],
      inactiveBorder: [206, 206, 206],
      windowFrame: [0, 0, 0],
      scrollbar: [230, 230, 230],
      buttonFace: [221, 221, 221],
      buttonShadow: [170, 170, 170],
      buttonText: [0, 0, 0],
      grayText: [137, 137, 137],
      highlight: [0, 0, 128],
      highlightText: [255, 255, 255],
      inactiveTitleText: [192, 192, 192],
      buttonHighlight: [255, 255, 255],
      infoText: [0, 0, 0],
      infoWindow: [255, 255, 225],
      buttonLight: [221, 221, 221],
      buttonDarkShadow: [119, 119, 119],
    },

    fonts: {
    },
  };
})();
