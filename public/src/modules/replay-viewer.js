// Spectate + replay viewer (roadmap #14). Two observer modes:
//   ?spectate=<zone>       follow the live zone as a camera-only observer
//   ?replay=1&zone=<zone>  loop the server's rolling 60 s snapshot buffer
// In both modes a "director" picks the operative with the most kills and the
// existing renderer/camera follows them. No game state is ever mutated here.
const OVERLAY_CSS = 'left:50%;top:14px;transform:translateX(-50%);padding:5px 12px;border:1px solid rgba(119,255,214,.5);border-radius:999px;background:rgba(9,16,20,.85);color:#9fffe2;font:700 11px system-ui,sans-serif;letter-spacing:.14em;pointer-events:none;';

export default {
  name: 'spectate-replay',
  summary: 'Live observer camera and rolling-buffer replay playback.',
  priority: 10, // camera director must run before other frame listeners
  setup(ctx) {
    const { state } = ctx;
    const replayZone = state.replayZone;
    const spectateZone = state.spectateZone;
    if (!replayZone && !spectateZone) return;

    const badge = ctx.dom(OVERLAY_CSS);
    badge.textContent = replayZone ? 'REPLAY' : 'SPECTATING';
    let frames = [];
    let startedAt = 0;
    let baseAt = 0;
    let targetId = null;

    function director(players) {
      // Keep watching the same operative while they are present and alive;
      // otherwise hand the camera to the current kill leader.
      if (targetId && players[targetId] && players[targetId].hp > 0) return players[targetId];
      const candidates = Object.values(players || {}).filter((player) => player.hp > 0 && player.kind !== 'ai');
      candidates.sort((a, b) => (b.kills || 0) - (a.kills || 0));
      targetId = candidates[0]?.id || null;
      return candidates[0] || null;
    }

    function applyFrame(frame) {
      state.players = frame.players || {};
      state.ai = frame.ai || {};
      state.projectiles = frame.projectiles || {};
      state.objectives = frame.objectives || state.objectives;
      const follow = director(state.players);
      if (follow) state.localPlayer = follow;
    }

    if (replayZone) {
      badge.textContent = 'REPLAY · LAST 60s';
      fetch('/api/replay/' + encodeURIComponent(replayZone))
        .then((response) => response.json())
        .then((data) => {
          if (!Array.isArray(data.frames) || data.frames.length === 0) {
            badge.textContent = 'REPLAY · NO DATA YET';
            return;
          }
          frames = data.frames;
          state.zone = data.zone || state.zone;
          startedAt = performance.now();
          baseAt = frames[0].at;
          if (data.zone?.name) badge.textContent = 'REPLAY · ' + data.zone.name.toUpperCase();
        })
        .catch(() => { badge.textContent = 'REPLAY · UNAVAILABLE'; });

      ctx.on('frame', ({ time }) => {
        if (!frames.length) return;
        const span = frames[frames.length - 1].at - baseAt || 1;
        const elapsed = (time - startedAt) % span;
        let index = 0;
        while (index < frames.length - 1 && frames[index].at - baseAt < elapsed) index += 1;
        applyFrame(frames[index]);
      });
    }

    // Live spectate: netcode fills state.players every broadcast; pick a
    // director once per frame so the camera always has a subject.
    if (spectateZone) {
      ctx.on('frame', () => {
        const follow = director(state.players);
        if (follow) state.localPlayer = follow;
      });
    }

    ctx.on('render:overlay', ({ ctx: draw, time }) => {
      // Soft recording dot on the badge keeps it visible against the world.
      const pulse = 0.6 + 0.4 * Math.sin(time * 0.006);
      draw.save();
      draw.globalAlpha = pulse;
      draw.fillStyle = '#ff6b7a';
      draw.beginPath();
      draw.arc(14, 19, 3.5, 0, Math.PI * 2);
      draw.fill();
      draw.restore();
    });
  }
};
