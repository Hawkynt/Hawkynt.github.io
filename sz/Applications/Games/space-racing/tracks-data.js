;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Race tracks. controlPoints form a closed Catmull-Rom loop (world units);
   * smooth = smoothing passes; features are placed along the lap:
   *   boost [t, lateral], hazards [t, lateral, type], gravity [t, side in track widths, mass, type],
   *   wormholes [tFrom, tTo], items [t]. t = fraction of the lap, lateral in world units (+ = left).
   */
  const TRACKS = [
    {
      name: 'Nebula Circuit', theme: 'nebula', width: 200, smooth: 0, laps: 3,
      controlPoints: [
        [0, 0], [1440, 0], [2160, 240], [2400, 720], [2160, 1200], [1440, 1440],
        [960, 1200], [600, 1440], [0, 1440], [-480, 960], [-480, 480]
      ],
      boost: [[0.08, 0], [0.55, 0]],
      hazards: [[0.3, 40, 'asteroid'], [0.72, -50, 'asteroid']],
      gravity: [[0.42, 1.6, 0.8, 'planet']],
      wormholes: [],
      items: [0.2, 0.64]
    },

    {
      name: 'Ion Storm Speedway', theme: 'storm', width: 200, smooth: 44, laps: 2,
      controlPoints: [
        [0, 0], [2400, 0], [2760, 240], [2760, 600], [2400, 840], [1080, 840],
        [720, 1080], [720, 1440], [1080, 1680], [2640, 1680], [3000, 1920], [2760, 2280],
        [0, 2280], [-360, 1920], [-360, 360]
      ],
      boost: [[0.05, 0], [0.3, 0], [0.62, 0]],
      hazards: [[0.18, -45, 'barrier'], [0.47, 50, 'barrier'], [0.8, 0, 'asteroid']],
      gravity: [[0.38, -1.7, 1.2, 'star']],
      wormholes: [[0.22, 0.33]],
      items: [0.12, 0.52, 0.88]
    },

    {
      name: 'Pulsar Drift', theme: 'pulsar', width: 190, smooth: 0, laps: 3,
      controlPoints: [
        [0, 0], [720, -360], [1440, 0], [1920, 480], [2640, 240], [3120, 720],
        [2880, 1440], [2160, 1680], [1680, 1320], [1200, 1680], [480, 1800], [-240, 1440],
        [-360, 720]
      ],
      boost: [[0.15, 0], [0.68, 0]],
      hazards: [[0.4, -40, 'asteroid'], [0.86, 45, 'asteroid']],
      gravity: [[0.28, 1.7, 1, 'pulsar'], [0.75, -1.7, 0.8, 'planet']],
      wormholes: [],
      items: [0.33, 0.8]
    },

    {
      name: 'Asteroid Alley', theme: 'asteroid', width: 180, smooth: 0, laps: 3,
      controlPoints: [
        [0, 0], [960, 0], [1200, 360], [1680, 360], [1920, 0], [2640, 0],
        [2880, 480], [2400, 960], [2640, 1440], [2160, 1800], [1440, 1560], [960, 1920],
        [240, 1800], [-120, 1320], [240, 960], [-120, 480]
      ],
      boost: [[0.04, 0], [0.5, 0]],
      hazards: [[0.12, -50, 'asteroid'], [0.22, 50, 'asteroid'], [0.36, 0, 'asteroid'],
        [0.6, -45, 'asteroid'], [0.78, 45, 'asteroid']],
      gravity: [],
      wormholes: [[0.64, 0.72]],
      items: [0.3, 0.7]
    },

    {
      name: 'Solar Flare Loop', theme: 'solar', width: 190, smooth: 16, laps: 3,
      controlPoints: [
        [0, 0], [1680, -240], [2640, 360], [2640, 1080], [1920, 1200], [1440, 840],
        [960, 1080], [1200, 1560], [2160, 1800], [1680, 2280], [480, 2160], [-360, 1560],
        [-360, 600]
      ],
      boost: [[0.1, 0], [0.58, 0]],
      hazards: [[0.33, 0, 'flare'], [0.83, -40, 'flare']],
      gravity: [[0.45, -1.8, 1.4, 'star']],
      wormholes: [],
      items: [0.25, 0.66]
    },

    {
      name: 'Comet Canyon', theme: 'comet', width: 170, smooth: 0, laps: 2,
      controlPoints: [
        [0, 0], [600, 0], [720, 480], [1080, 480], [1200, 0], [1800, 0],
        [1920, 480], [2280, 480], [2400, 0], [3120, 0], [3360, 600], [3000, 1080],
        [3360, 1560], [2880, 2040], [2040, 2040], [1800, 1560], [1320, 1560], [1080, 2040],
        [240, 2040], [-240, 1440], [120, 960], [-240, 480]
      ],
      boost: [[0.02, 0], [0.46, 0], [0.74, 0]],
      hazards: [[0.15, 40, 'asteroid'], [0.28, -40, 'asteroid'], [0.55, 0, 'barrier'], [0.88, 35, 'asteroid']],
      gravity: [[0.62, 1.7, 0.9, 'planet']],
      wormholes: [[0.8, 0.9]],
      items: [0.2, 0.5, 0.85]
    },

    {
      name: 'Quasar Ring', theme: 'quasar', width: 200, smooth: 0, laps: 3,
      controlPoints: [
        [0, 0], [2160, 0], [3120, 600], [3240, 1440], [2640, 2040], [1920, 2160],
        [1680, 1680], [1200, 1680], [960, 2040], [240, 2040], [-480, 1440], [-480, 600]
      ],
      boost: [[0.06, 0], [0.4, 0], [0.7, 0]],
      hazards: [[0.25, -45, 'barrier'], [0.58, 45, 'asteroid']],
      gravity: [[0.52, 1.9, 1.6, 'quasar']],
      wormholes: [[0.86, 0.94]],
      items: [0.15, 0.48, 0.78]
    },

    {
      name: 'Void Serpent', theme: 'void', width: 170, smooth: 20, laps: 2,
      controlPoints: [
        [0, 0], [480, -240], [960, 0], [1440, -240], [1920, 0], [2400, -240],
        [3120, 0], [3480, 600], [3120, 1080], [2400, 960], [1920, 1200], [2400, 1560],
        [3120, 1560], [3360, 2040], [2880, 2400], [1680, 2400], [960, 2040], [240, 2280],
        [-360, 1800], [0, 1200], [-360, 600]
      ],
      boost: [[0.03, 0], [0.38, 0], [0.66, 0]],
      hazards: [[0.12, 40, 'asteroid'], [0.22, -40, 'asteroid'], [0.48, 0, 'barrier'],
        [0.58, 40, 'flare'], [0.9, -35, 'asteroid']],
      gravity: [[0.3, -1.8, 1.2, 'blackhole'], [0.78, 1.8, 1, 'planet']],
      wormholes: [[0.44, 0.53]],
      items: [0.18, 0.42, 0.72, 0.92]
    }
  ];

  SZ.RacingTracks = Object.freeze(TRACKS.map(t => Object.freeze(t)));
})();
