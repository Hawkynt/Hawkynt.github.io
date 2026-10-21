/* Difficulty themes and the inline SVG icon set with its data-URI encoder. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const T = NS.data;

  /* ---- Difficulty Themes ---- */
  T.THEME_CONFIG = {
    meadow:  { particles: ['#6a4', '#8c6', '#ff0', '#fa0'], confetti: ['#6a4', '#8c6', '#4a2', '#ff0', '#fa0', '#f80'] },
    steel:   { particles: ['#6cf', '#adf', '#fff', '#8af'], confetti: ['#6cf', '#adf', '#8af', '#fff', '#68a', '#4af'] },
    inferno: { particles: ['#f44', '#f80', '#ff0', '#fa0'], confetti: ['#f44', '#f80', '#ff0', '#fa0', '#f00', '#ff6'] },
    neutral: { particles: ['#f44', '#f80', '#ff0', '#fa0', '#f00', '#fff'], confetti: ['#f44', '#4af', '#fa0', '#4f4', '#f4f', '#ff0'] }
  };

  T.getThemeForDifficulty = function getThemeForDifficulty(diff) {
    if (diff === 'beginner') return 'meadow';
    if (diff === 'intermediate') return 'steel';
    if (diff === 'expert') return 'inferno';
    return 'neutral';
  };

  /* ---- SVG Icons ---- */
  T.SVG_ICONS = {
    mine: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>
      <defs><radialGradient id='mg' cx='35%' cy='35%' r='55%'>
        <stop offset='0%' stop-color='#555'/><stop offset='100%' stop-color='#000'/>
      </radialGradient></defs>
      <circle cx='8' cy='8' r='4.5' fill='url(#mg)'/>
      <line x1='8' y1='1.5' x2='8' y2='3.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='8' y1='12.5' x2='8' y2='14.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='1.5' y1='8' x2='3.5' y2='8' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='12.5' y1='8' x2='14.5' y2='8' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='3.4' y1='3.4' x2='5' y2='5' stroke='#000' stroke-width='1.2' stroke-linecap='round'/>
      <line x1='11' y1='5' x2='12.6' y2='3.4' stroke='#000' stroke-width='1.2' stroke-linecap='round'/>
      <line x1='3.4' y1='12.6' x2='5' y2='11' stroke='#000' stroke-width='1.2' stroke-linecap='round'/>
      <line x1='11' y1='11' x2='12.6' y2='12.6' stroke='#000' stroke-width='1.2' stroke-linecap='round'/>
      <circle cx='6' cy='6.2' r='1.8' fill='rgba(255,255,255,0.4)'/>
    </svg>`,
    flag: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>
      <defs><linearGradient id='fg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#f44'/><stop offset='100%' stop-color='#c00'/>
      </linearGradient></defs>
      <polygon points='4,2 4,9.5 11,5.75' fill='url(#fg)'/>
      <rect x='3' y='2' width='1.5' height='10' rx='0.3' fill='#000'/>
      <rect x='1.5' y='12' width='6' height='1.2' rx='0.3' fill='#000'/>
      <rect x='0.5' y='13.2' width='8' height='1.3' rx='0.3' fill='#000'/>
    </svg>`,
    faceNormal: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='11' fill='#ff0' stroke='#000' stroke-width='1.5'/>
      <circle cx='9' cy='10' r='1.8' fill='#000'/>
      <circle cx='17' cy='10' r='1.8' fill='#000'/>
      <path d='M8 16 Q13 21 18 16' fill='none' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
    </svg>`,
    faceClick: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='11' fill='#ff0' stroke='#000' stroke-width='1.5'/>
      <circle cx='9' cy='10' r='1.8' fill='#000'/>
      <circle cx='17' cy='10' r='1.8' fill='#000'/>
      <circle cx='13' cy='17' r='2.5' fill='none' stroke='#000' stroke-width='1.5'/>
    </svg>`,
    faceWin: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='11' fill='#ff0' stroke='#000' stroke-width='1.5'/>
      <rect x='5' y='8.5' width='7' height='4' rx='1.5' fill='#000'/>
      <rect x='14' y='8.5' width='7' height='4' rx='1.5' fill='#000'/>
      <rect x='11.5' y='9.5' width='3' height='2' fill='#000'/>
      <path d='M8 17 Q13 22 18 17' fill='none' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
    </svg>`,
    faceDead: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='11' fill='#ff0' stroke='#000' stroke-width='1.5'/>
      <line x1='6.5' y1='7.5' x2='11.5' y2='12.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='11.5' y1='7.5' x2='6.5' y2='12.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='14.5' y1='7.5' x2='19.5' y2='12.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='19.5' y1='7.5' x2='14.5' y2='12.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <path d='M8 19 Q13 15 18 19' fill='none' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
    </svg>`,
    faceSkull: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <defs><radialGradient id='sg' cx='50%' cy='40%' r='50%'>
        <stop offset='0%' stop-color='#fff'/><stop offset='100%' stop-color='#e0d5c8'/>
      </radialGradient></defs>
      <ellipse cx='13' cy='11' rx='9' ry='8.5' fill='url(#sg)' stroke='#555' stroke-width='1'/>
      <ellipse cx='9.5' cy='10' rx='2.5' ry='2.8' fill='#1a1a1a'/>
      <ellipse cx='16.5' cy='10' rx='2.5' ry='2.8' fill='#1a1a1a'/>
      <path d='M12 14.5 L14 14.5 L13 16.5 Z' fill='#333'/>
      <rect x='7' y='17.5' width='12' height='3.5' rx='1' fill='url(#sg)' stroke='#555' stroke-width='0.8'/>
      <line x1='9' y1='17.5' x2='9' y2='21' stroke='#888' stroke-width='0.5'/>
      <line x1='11' y1='17.5' x2='11' y2='21' stroke='#888' stroke-width='0.5'/>
      <line x1='13' y1='17.5' x2='13' y2='21' stroke='#888' stroke-width='0.5'/>
      <line x1='15' y1='17.5' x2='15' y2='21' stroke='#888' stroke-width='0.5'/>
      <line x1='17' y1='17.5' x2='17' y2='21' stroke='#888' stroke-width='0.5'/>
      <path d='M10 3.5 L11.5 6.5 L10 8.5' fill='none' stroke='#aaa' stroke-width='0.6'/>
    </svg>`
  };

  T.svgToDataUri = function svgToDataUri(svg) {
    return 'url("data:image/svg+xml,' + svg
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/#/g, '%23')
      .replace(/</g, '%3C')
      .replace(/>/g, '%3E')
      .replace(/"/g, "'") + '")';
  };
})();
