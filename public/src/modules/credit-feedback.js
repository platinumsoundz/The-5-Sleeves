// Turn authoritative balance increases into short HUD feed entries.
const MAX_CREDIT_NOTICES = 5;
const CREDIT_COLOR = '#f3d879';

export default {
  name: 'credit-feedback',
  summary: 'Shows earned credits in the HUD notification feed.',
  priority: 45,
  setup(ctx) {
    let lastCredits = null;
    ctx.on('frame', ({ state, time }) => {
      const player = state.localPlayer;
      if (!player || !Number.isFinite(player.credits)) { lastCredits = null; return; }
      const credits = Math.round(player.credits);
      if (lastCredits === null) { lastCredits = credits; return; }
      const earned = credits - lastCredits;
      lastCredits = credits;
      if (earned <= 0) return;

      const feed = state.killFeed || (state.killFeed = []);
      feed.push({ text: '+' + earned + ' CREDITS', at: time, color: CREDIT_COLOR });
      while (feed.length > MAX_CREDIT_NOTICES) feed.shift();
    });
  }
};
