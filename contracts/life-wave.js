// Presentation derived from Brain state, not a medical measurement or host load.
export function lifeWave(life = {}) {
  const unit = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : fallback / 100;
  const energy = unit(life.energy, 85), mood = unit(life.mood, 80);
  const asleep = life.mode === 'Dormancy', tension = 1 - mood;
  return {
    bpm: asleep ? 48 + 8 * tension + 4 * (1 - energy) : 64 + 14 * energy + 12 * tension,
    respirationHz: (asleep ? 10 + 3 * tension : 13 + 4 * energy + 3 * tension) / 60,
    amplitude: asleep ? .6 : .55 + .55 * energy,
    intervalVariation: asleep ? .025 + .02 * tension : .045 + .08 * tension,
    noise: asleep ? .3 : .5 + 1.5 * tension,
    activity: asleep ? 0 : energy * 100
  };
}
