// Per-operative checks for walking through a zone exit.
function canUseExit(player, zone, direction) {
  // A city's east road stays sealed until that operative clears its tower.
  if (zone?.kind === 'haven' && direction === 'east' && zone.towerIndex && !player?.towers?.[zone.towerIndex]) {
    return { ok: false, reason: 'Clear ' + (zone.towerName || zone.tower?.name || 'the regional tower') + ' before leaving the city.' };
  }
  return { ok: true };
}

module.exports = { canUseExit };
