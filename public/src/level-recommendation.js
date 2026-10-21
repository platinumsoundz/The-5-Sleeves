// Keep road gates, tower entrances and arrival messages consistent.
export function recommendedLevelLabel(levelBand) {
  if (!Array.isArray(levelBand) || levelBand.length !== 2) return '';
  const [minimum, maximum] = levelBand;
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum < 1 || maximum < minimum) return '';
  return 'Recommended Level: ' + minimum + (maximum === minimum ? '' : '–' + maximum);
}
