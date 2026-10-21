// Enemy definitions live here so content editors can tune data without changing AI code.
// To add another definition, choose a unique id and a behavior supported by enemy-registry.js.
const RUST_WARDEN = Object.freeze({
  id: 'rust-warden',
  name: 'Rust Warden',
  size: 'medium',
  behavior: 'warden-patrol-shooter',
  stats: Object.freeze({
    hp: 90, speed: 74, aggro: 330, attackRange: 240, shotCooldown: 1500,
    damage: 12, projectileSpeed: 300, projectileRadius: 7, projectileLifetimeMs: 1800, radius: 15,
    xp: 12, skillPoints: 1, coreCharge: 10, credits: 14
  }),
  scaling: Object.freeze({
    hpPerTier: 0.28, damagePerTier: 0.2, speedPerTier: 0.035,
    aggroPerTier: 18, rangePerTier: 10, xpPerTier: 0.45, creditsPerTier: 0.55
  }),
  visuals: Object.freeze({
    color: '#c98b3a', accentColor: '#ffd9a0',
    projectileColor: '#ffb266', projectileAccent: '#ffe0b0'
  })
});

// Key by stable id: saved data and spawn callers should never rely on display names.
const ENEMY_CATALOG = Object.freeze({ [RUST_WARDEN.id]: RUST_WARDEN });

module.exports = { ENEMY_CATALOG, RUST_WARDEN };
