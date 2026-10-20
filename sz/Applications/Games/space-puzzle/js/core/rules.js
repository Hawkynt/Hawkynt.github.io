/* The rating rules: how moves against par become a star rating, and how that
   rating is spelled out for the player. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});

  function calculateRating(moves, par) {
    if (moves <= par) return 3; // 3 stars — perfect
    if (moves <= par + 1) return 2; // 2 stars — good
    return 1; // 1 star — completed
  }

  function ratingToStars(rating) {
    return '★'.repeat(rating) + '☆'.repeat(3 - rating);
  }

  Object.assign(NS.rules, { calculateRating, ratingToStars });
})();
