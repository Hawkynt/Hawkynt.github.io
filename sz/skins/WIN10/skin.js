;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const skins = SZ.skins || (SZ.skins = {});

  const BASE = 'skins/WIN10';

  skins['WIN10'] = {
    name: 'Windows 1.0',
    author: 'aznvmlinuz',
    email: 'ebcwl@cwnet.com',
    url: 'http://users.cwnet.com/ebcwl',
    generator: 'Stardock SkinStudio ver 3.0.0, Build 619  - http://www.skinstudio.net',
    editorNotes: 'Thanks to Nathan\'s Toasty Technology Page for the Windows 1.0 screenshots (http://toastytech.com/guis/index.html).',
    wbVersion: 400,
    basePath: BASE,

    personality: {
      buttoncount: 3,
      textalignment: 1,
      textshift: 20,
      textshiftvert: 1,
      textrightclip: 20,
      top: `${BASE}/TOP.BMP`,
      left: `${BASE}/LEFT.BMP`,
      right: `${BASE}/RIGHT.BMP`,
      bottom: `${BASE}/BOTTOM.BMP`,
      anirate: 0,
      topframe: 2,
      leftframe: 2,
      rightframe: 2,
      bottomframe: 2,
      toptopheight: 1,
      topbotheight: 1,
      lefttopheight: 24,
      leftbotheight: 26,
      righttopheight: 24,
      rightbotheight: 26,
      bottomtopheight: 2,
      bottombotheight: 91,
      topstretch: 0,
      leftstretch: 1,
      rightstretch: 1,
      bottomstretch: 1,
      menur: 0,
      menug: 0,
      menub: 0,
      activetextr: 255,
      activetextg: 255,
      activetextb: 255,
      inactivetextr: 192,
      inactivetextg: 192,
      inactivetextb: 192,
      menutextr: 0,
      menutextg: 0,
      menutextb: 0,
      rollupsize: 27,
      mouseover: 1,
      tripleimages: 0,
      soundenabled: 0,
      tilemenu: 1,
      menubar: `${BASE}/MENU.BMP`,
      menuborders: `${BASE}/MENUBORDER.BMP`,
      explorerbmp: `${BASE}/EXPLORE.BMP`,
      dialogbmp: `${BASE}/DIALOG.BMP`,
      mdibmp: `${BASE}/EXPLORE.BMP`,
      textbackground: 1,
      textback: `${BASE}/TITLEBAR.BMP`,
    },

    buttons: {
      checkbutton: `${BASE}/CHECKBOX.BMP`,
      radiobutton: `${BASE}/RADIO.BMP`,
      bitmap: `${BASE}/BUTTON.BMP`,
      topheight: 3,
      bottomheight: 3,
      leftwidth: 3,
      rightwidth: 3,
      mouseover: 1,
      tile: 3,
    },

    titleButtons: [
      { image: `${BASE}/SYSICO.BMP`, align: 0, xcoord: 4, ycoord: 0, action: 0, alpha: 255, visibility: 0 },
      { image: `${BASE}/MAX.BMP`, align: 1, xcoord: 20, ycoord: 0, action: 1, visibility: 24 },
      { image: `${BASE}/MIN.BMP`, align: 1, xcoord: 36, ycoord: 0, action: 23, visibility: 22 },
    ],

    comboButton: {
    },

    taskButton: {
      image: `${BASE}/TASKS.BMP`,
      topheight: 3,
      bottomheight: 3,
      leftwidth: 3,
      rightwidth: 3,
    },

    progressBar: {
      image: `${BASE}/PROGRESS.BMP`,
      topheight: 5,
      bottomheight: 5,
      leftwidth: 5,
      rightwidth: 2,
      tile: 3,
      tilemode: 2,
      trans: 1,
    },

    tabControl: {
      image: `${BASE}/TABS.BMP`,
      topheight: 3,
      bottomheight: 3,
      leftwidth: 3,
      rightwidth: 3,
      tile: 3,
    },

    startButton: { image: `${BASE}/START.BMP` },

    colors: {
      scrollbar: [255, 255, 255],
      background: [0, 128, 128],
      activeTitle: [0, 0, 128],
      inactiveTitle: [128, 128, 128],
      menu: [255, 255, 0],
      window: [255, 255, 255],
      windowFrame: [0, 0, 0],
      menuText: [0, 0, 0],
      windowText: [0, 0, 0],
      titleText: [255, 255, 255],
      activeBorder: [255, 255, 255],
      inactiveBorder: [255, 255, 255],
      appWorkspace: [0, 0, 255],
      highlight: [0, 0, 0],
      highlightText: [255, 255, 255],
      buttonFace: [255, 255, 255],
      buttonShadow: [0, 0, 0],
      grayText: [128, 128, 128],
      buttonText: [0, 0, 0],
      inactiveTitleText: [192, 192, 192],
      buttonHighlight: [255, 255, 255],
      buttonDarkShadow: [0, 0, 0],
      buttonLight: [255, 255, 255],
      infoText: [0, 0, 0],
      infoWindow: [255, 255, 225],
      buttonAlternateFace: [0, 0, 0],
      hotTrackingColor: [0, 0, 255],
      gradientActiveTitle: [0, 0, 255],
      gradientInactiveTitle: [192, 192, 192],
    },

    customFonts: [
      { fontangle: 0, antialias: 1, fontname: 'Arial', fontheight: 11, italics: 0, underline: 0, fontweight: 400, shadowb: 128, shadowg: 128, shadowr: 128, shadowoffset: 1, drawingstyle: 1 },
    ],

    customColors: [
      { r: 0, g: 0, b: 0 },
    ],

    fonts: {
      family: 'System',
      height: 12,
      weight: 400,
      antialias: false,
    },
  };
})();
