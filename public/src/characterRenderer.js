import { DOMAINS } from './config.js';
import { drawSpriteOrProcedural, optionalImage } from './assetLoader.js';

function drawAjaye(ctx, x, y, player, time) {
  ctx.save(); ctx.translate(x, y);
  // Front-facing view: Ajaye's anatomical left arm is screen-right; only it has the Sleeve.
  ctx.fillStyle = '#17191b'; ctx.fillRect(-8, -3, 16, 16);
  ctx.fillStyle = '#2c2d2d'; ctx.fillRect(-9, 1, 18, 4);
  ctx.fillStyle = '#0f1114'; ctx.fillRect(-7, 12, 6, 9); ctx.fillRect(2, 12, 6, 9);
  ctx.fillStyle = '#27292a'; ctx.fillRect(-8, 19, 8, 3); ctx.fillRect(1, 19, 8, 3);
  // Ordinary cloth right arm and warm skin: explicitly no Sleeve on this arm.
  ctx.fillStyle = '#252729'; ctx.fillRect(-13, -2, 5, 13); ctx.fillStyle = '#bc805f'; ctx.fillRect(-13, 9, 5, 3);
  const domain = player.energyColor || 'cipher';
  const primary = player.color || DOMAINS[domain]?.primary || '#00ffff';
  // Dark segmented forearm device and cyan/selected-domain channels on anatomical left.
  ctx.fillStyle = '#151c21'; ctx.fillRect(8, -2, 6, 14);
  ctx.fillStyle = '#313f43'; ctx.fillRect(8, 2, 6, 2); ctx.fillRect(8, 7, 6, 2);
  ctx.fillStyle = primary; ctx.shadowBlur = 7; ctx.shadowColor = primary;
  ctx.fillRect(10, 0, 2, 11); ctx.fillRect(8, 4, 6, 1); ctx.shadowBlur = 0;
  // Patched charcoal scavenger clothes, utility straps, hood/scarf, curls and blue eyes.
  ctx.fillStyle = '#101316'; ctx.fillRect(-9, -9, 18, 8); ctx.fillRect(-7, -5, 14, 3);
  ctx.fillStyle = '#8b664d'; ctx.fillRect(-5, -17, 10, 9);
  ctx.fillStyle = '#674431'; ctx.fillRect(-7, -22, 14, 9);
  ctx.fillRect(-9, -19, 3, 6); ctx.fillRect(-6, -24, 4, 4); ctx.fillRect(-1, -25, 5, 4); ctx.fillRect(4, -22, 4, 5);
  ctx.fillStyle = '#b67c54'; ctx.fillRect(-6, -21, 3, 3); ctx.fillRect(-1, -23, 3, 3); ctx.fillRect(4, -20, 3, 3);
  ctx.fillStyle = '#1c83d4'; ctx.fillRect(-4, -15, 2, 2); ctx.fillRect(3, -15, 2, 2);
  ctx.fillStyle = '#151719'; ctx.fillRect(-5, -9, 10, 2);
  ctx.fillStyle = '#858078'; ctx.fillRect(-5, -2, 2, 14); ctx.fillRect(3, -1, 2, 11);
  ctx.fillStyle = '#55483b'; ctx.fillRect(-9, 5, 4, 4); ctx.fillRect(5, 6, 3, 4);
  if (domain === 'dark' && Math.sin(time * .04 + player.x) > .35) {
    ctx.fillStyle = player.accentColor || '#ff29d6'; ctx.fillRect(-10, -19, 4, 2); ctx.fillRect(8, -4, 5, 2);
  }
  ctx.restore();
}

function drawAura(ctx, player, time, color, accent) {
  const halo = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 38);
  halo.addColorStop(0, color + '55'); halo.addColorStop(1, color + '00');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(player.x, player.y, 38, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    const angle = time * (player.energyColor === 'wind' ? .004 : .0018) + i * Math.PI * .4;
    const glitch = player.energyColor === 'dark' ? Math.sin(time * .045 + i * 17) * 5 : 0;
    const radius = 22 + glitch;
    ctx.fillStyle = i % 2 ? accent : color;
    if (player.energyColor === 'dark' && i % 2 === 0) ctx.fillRect(player.x + Math.cos(angle) * radius - 2, player.y + Math.sin(angle) * radius - 2, 5, 5);
    else { ctx.beginPath(); ctx.arc(player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, 2.4, 0, Math.PI * 2); ctx.fill(); }
  }
}

export function drawPlayer(ctx, player, localId, time) {
  const domain = DOMAINS[player.energyColor] || DOMAINS.cipher;
  const color = player.color || domain.primary;
  drawAura(ctx, player, time, color, player.accentColor || domain.accent);
  const image = optionalImage('assets/player_' + (player.energyColor || 'cipher') + '.png');
  drawSpriteOrProcedural(ctx, image,
    (context, x, y, width, height) => drawAjaye(context, x + width / 2, y + height / 2, player, time),
    player.x - 16, player.y - 17, 32, 40);
  if (Date.now() < player.shieldUntil) {
    ctx.beginPath(); ctx.arc(player.x, player.y, 25, 0, Math.PI * 2); ctx.strokeStyle = '#7bd8ff'; ctx.lineWidth = 3; ctx.stroke();
  }
  const barWidth = 42, hpRatio = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = '#311923'; ctx.fillRect(player.x - barWidth / 2, player.y - 30, barWidth, 5);
  ctx.fillStyle = player.hp > 35 ? '#4ef2a1' : '#ff596d'; ctx.fillRect(player.x - barWidth / 2, player.y - 30, barWidth * hpRatio, 5);
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(player.id === localId ? 'You' : player.name, player.x, player.y - 37);
  if (player.inCore) { ctx.fillStyle = '#70ffe1'; ctx.font = '10px system-ui'; ctx.fillText('CHARGING ' + Math.floor(player.coreCharge) + '% · ' + player.corePoints + ' pts', player.x, player.y + 30); }
  if (player.hp <= 0) { ctx.fillStyle = '#ff9eaa'; ctx.font = 'bold 10px system-ui'; ctx.fillText('DOWN', player.x, player.y + 31); }
}
