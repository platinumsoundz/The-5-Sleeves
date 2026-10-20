function markIntroSeen(player) {
  const firstVisit = player.cipherIntroSeen !== true;
  player.cipherIntroSeen = true;
  return firstVisit;
}

module.exports = {
  name: 'cipher-companion-memory',
  summary: 'Persist each operative’s first meeting with the allied Cipher AI.',
  priority: 35,
  setup(ctx) {
    ctx.on('joining', (player, profile) => {
      player.cipherIntroSeen = profile?.cipherIntroSeen === true;
    });
    ctx.on('persist', (player, record) => {
      record.cipherIntroSeen = player.cipherIntroSeen === true;
    });
  },
  markIntroSeen
};
