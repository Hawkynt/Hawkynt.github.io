;(function() {
  'use strict';

  // The Dome Keeper namespace. Every module adds its exports as NS.<module>;
  // NS.state is the one shared context object: run state that several modules
  // read or write lives there as plain properties (each owner initialises its
  // fields at load and lists them in its header).
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.DomeKeeper || (SZ.DomeKeeper = {});
  NS.state = {};
})();
