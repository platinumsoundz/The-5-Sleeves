// Archive Echoes: floating Tower-log fragments operatives can walk over and
// collect for a skill point, core charge and XP. They respawn on a timer.
const { ARCHIVE_LOGS, XP_ECHO } = require('./spec.js');
const { distance } = require('./combat.js');
const { CORE } = require('./state.js');

const MAX_ARCHIVE_ECHOES = 5;

function spawnArchiveEcho(sim) {
  const columns = Math.floor(sim.world.width / 40);
  const rows = Math.floor(sim.world.height / 40);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = (1 + Math.floor(Math.random() * (columns - 2))) * 40 + 20;
    const y = (1 + Math.floor(Math.random() * (rows - 2))) * 40 + 20;
    if (distance({ x, y }, CORE) < 150) continue;
    if (Object.values(sim.echoes).some((echo) => distance(echo, { x, y }) < 70)) continue;
    const id = 'echo-' + sim.next.echo++;
    sim.echoes[id] = { id, x, y, loreIndex: (sim.next.echo - 2) % ARCHIVE_LOGS.length };
    return true;
  }
  return false;
}

function collectArchiveEchoes(sim, player) {
  if (!player || player.hp <= 0) return false;
  let collected = false;
  for (const [id, echo] of Object.entries(sim.echoes)) {
    if (distance(player, echo) > 25) continue;
    delete sim.echoes[id];
    player.skillPoints += 1;
    player.coreCharge = Math.min(99.99, player.coreCharge + 15);
    sim.host.applyXp(player, XP_ECHO);
    sim.host.playerSockets[player.id]?.emit('archive:collected', {
      echoId: id,
      lore: ARCHIVE_LOGS[echo.loreIndex] || ARCHIVE_LOGS[0],
      skillPoints: player.skillPoints,
      coreCharge: player.coreCharge
    });
    sim.host.awardNearbyParty(player);
    collected = true;
  }
  if (collected) sim.host.persistPlayer(player);
  return collected;
}

module.exports = { MAX_ARCHIVE_ECHOES, spawnArchiveEcho, collectArchiveEchoes };
