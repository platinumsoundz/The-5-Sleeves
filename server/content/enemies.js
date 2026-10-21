// Enemy definitions live here so content editors can tune data without changing AI code.
// To add another definition, choose a unique id and a behavior supported by enemy-registry.js.
const RUST_WARDEN = Object.freeze({
  id: 'rust-warden',
  name: 'Rust Warden',
  size: 'medium',
  behavior: 'patrol-shooter',
  counterKey: 'warden',
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
const SCAVENGER_DRONE = Object.freeze({
  id: 'scavenger-drone',
  name: 'Scavenger Drone',
  size: 'small',
  behavior: 'patrol-shooter',
  counterKey: 'drone',
  spawnCount: 2,
  stats: Object.freeze({
    hp: 35, speed: 105, aggro: 270, attackRange: 185, shotCooldown: 2100,
    damage: 5, projectileSpeed: 270, projectileRadius: 5, projectileLifetimeMs: 1600, radius: 8,
    xp: 4, skillPoints: 0, coreCharge: 2, credits: 4
  }),
  scaling: Object.freeze({
    hpPerTier: 0.18, damagePerTier: 0.15, speedPerTier: 0.025,
    aggroPerTier: 12, rangePerTier: 6, xpPerTier: 0.25, creditsPerTier: 0.3
  }),
  visuals: Object.freeze({
    color: '#718894', accentColor: '#d5e8df',
    projectileColor: '#d9a86e', projectileAccent: '#ffe0b0'
  })
});

const ENEMY_CATALOG = Object.freeze({
  [RUST_WARDEN.id]: RUST_WARDEN,
  [SCAVENGER_DRONE.id]: SCAVENGER_DRONE
});

module.exports = { ENEMY_CATALOG, RUST_WARDEN, SCAVENGER_DRONE };
