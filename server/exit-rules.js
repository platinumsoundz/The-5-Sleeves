// Per-operative checks for walking through a zone exit.
function canUseExit(player, zone, direction) {
  // The final frontier gate is tied to the operative's Tower 5 milestone.
  if (zone?.id === 'haven-citadel' && direction === 'east' && !player?.towers?.[5]) {
    return { ok: false, reason: 'Clear Tower 5 to open the eastern passage.' };
  }
  // Earlier cities keep their east roads sealed until their local tower is clear.
  if (zone?.kind === 'haven' && direction === 'east' && zone.towerIndex && !player?.towers?.[zone.towerIndex]) {
    return { ok: false, reason: 'Clear ' + (zone.towerName || zone.tower?.name || 'the regional tower') + ' before leaving the city.' };
  }
  return { ok: true };
}

module.exports = { canUseExit };
