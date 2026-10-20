import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_TREE, skillById, skillBonuses } from '../server/skill-tree.js';
import { DOMAIN_ABILITIES, abilityFor } from '../server/sim/abilities.js';
import { SKILL_TREE as CLIENT_SKILL_TREE } from '../public/src/config.js';

test('the skill tree mirrors client costs and prices deeper tiers higher', () => {
  assert.deepEqual(CLIENT_SKILL_TREE.map(({ id, cost }) => [id, cost]), SKILL_TREE.map(({ id, cost }) => [id, cost]));
  assert.equal(skillById('conduit-root').cost, 1);
  assert.equal(skillById('void-step').cost, 4);
});

test('the skill tree mirrors the client layout and every node is reachable', () => {
  assert.equal(SKILL_TREE.length, 6);
  for (const node of SKILL_TREE) {
    assert.ok(node.id && node.name && node.desc, node.id + ' has display data');
    for (const parent of node.requires) assert.ok(skillById(parent), node.id + ' requires a real node');
  }
  assert.equal(skillById('pulse-focus'), null, 'Cipher-only upgrades are not offered to playable factions');
  assert.equal(skillById('not-a-node'), null);
});

test('skill bonuses are neutral until points are spent', () => {
  const bonuses = skillBonuses({});
  assert.equal(bonuses.abilityCooldownScale, 1);
  assert.equal(bonuses.dashCooldownScale, 1);
  assert.equal(bonuses.wallHp, 0);
  assert.equal(bonuses.wallHeal, false);
  assert.equal(skillBonuses(undefined).abilityCooldownScale, 1);
});

test('each unlocked branch contributes its own tuning bonus', () => {
  const bonuses = skillBonuses({ skills: { 'conduit-root': true, 'gale-thread': true, 'gale-crown': true, 'void-step': true, 'ward-plate': true, 'ward-bastion': true } });
  assert.equal(bonuses.abilityCooldownScale, 0.9);
  assert.equal(bonuses.dashCooldownScale, 0.82);
  assert.equal(bonuses.galeRadius, 25);
  assert.equal(bonuses.galeDamage, 3);
  assert.equal(bonuses.dashDistance, 34);
  assert.equal(bonuses.wallHp, 60);
  assert.equal(bonuses.wallDuration, 1800);
  assert.equal(bonuses.wallHeal, true);
});

test('Cipher cannot be selected as a playable ability and legacy profiles fall back to Wind', () => {
  assert.deepEqual(Object.keys(DOMAIN_ABILITIES).sort(), ['dark', 'earth', 'fire', 'water', 'wind']);
  assert.equal(abilityFor({ energyColor: 'cipher' }).id, DOMAIN_ABILITIES.wind.id);
});

test('wind and earth nodes tune gale and bulwark', () => {
  const gale = abilityFor({ energyColor: 'wind', skills: { 'conduit-root': true, 'gale-thread': true, 'gale-crown': true } });
  assert.equal(gale.radius, DOMAIN_ABILITIES.wind.radius + 25);
  assert.equal(gale.damage, DOMAIN_ABILITIES.wind.damage + 3);
  assert.equal(gale.cooldown, Math.round(DOMAIN_ABILITIES.wind.cooldown * 0.9));
  const wall = abilityFor({ energyColor: 'earth', skills: { 'conduit-root': true, 'ward-plate': true, 'ward-bastion': true } });
  assert.equal(wall.wallHp, DOMAIN_ABILITIES.earth.wallHp + 60);
  assert.equal(wall.duration, DOMAIN_ABILITIES.earth.duration + 1800);
  assert.equal(wall.healAllies, true);
});
