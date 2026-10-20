// Per-operative checks for walking through a zone exit.
function canUseExit(player, zone, direction) {
  // A city's east road stays sealed until that operative clears its tower.
  if (zone?.kind === 'haven' && direction === 'east' && zone.towerIndex && !player?.towers?.[zone.towerIndex]) {
    return { ok: false, reason: 'Clear ' + (zone.towerName || zone.tower?.name || 'the regional tower') + ' before leaving the city.' };
  }
  if (zone?.id === 'haven-citadel' && direction === 'east' && !player?.towers?.[5]) {
    return { ok: false, reason: 'Clear Tower 5 to open the eastern passage.' };
  }
  return { ok: true };
}

module.exports = { canUseExit };
