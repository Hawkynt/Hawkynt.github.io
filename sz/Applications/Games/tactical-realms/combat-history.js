;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Session-wide combat history — stores all combat logs for the current play session.
  // Survives across multiple encounters but resets on page reload.

  const _history = [];

  const CombatHistory = {

    // Archive the current combat log with metadata
    archive(combatLog, metadata) {
      if (!combatLog || combatLog.length === 0) return;
      _history.push(Object.freeze({
        id: _history.length + 1,
        timestamp: new Date().toLocaleTimeString(),
        location: metadata?.location || 'Unknown',
        biome: metadata?.biome || 'plains',
        outcome: metadata?.outcome || 'unknown',
        rounds: metadata?.rounds || 0,
        partySize: metadata?.partySize || 0,
        enemyCount: metadata?.enemyCount || 0,
        log: Object.freeze([...combatLog]),
      }));
    },

    // Get all archived combats
    getAll() {
      return _history;
    },

    // Get a specific combat by index
    get(index) {
      return _history[index] || null;
    },

    // Number of archived combats
    get count() {
      return _history.length;
    },

    // Format a single combat's log as copyable text
    formatLog(combat) {
      if (!combat) return '';
      const header = `=== Combat #${combat.id} — ${combat.timestamp} ===\n` +
        `Location: ${combat.location} | Biome: ${combat.biome}\n` +
        `Outcome: ${combat.outcome} | Rounds: ${combat.rounds}\n` +
        `Party: ${combat.partySize} | Enemies: ${combat.enemyCount}\n` +
        '─'.repeat(60) + '\n';
      return header + combat.log.join('\n') + '\n' + '═'.repeat(60) + '\n';
    },

    // Format all combats as one big copyable text
    formatAll() {
      if (_history.length === 0) return 'No combat history this session.';
      return _history.map(c => CombatHistory.formatLog(c)).join('\n');
    },

    // Clear history
    clear() {
      _history.length = 0;
    },
  };

  TR.CombatHistory = CombatHistory;
})();
