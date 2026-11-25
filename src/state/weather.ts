// Weather schedule and state calculation (plan WX2, design 5.7, 6.8).
import { WEATHER } from '../data/look';

export interface WeatherState {
  id: string;
  blend: number;
}

function hashBucket(day: number, bucket: number): number {
  let x = (day * 10 + bucket) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 1 | x);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0);
}

export function weatherAt(
  dayIndex: number,
  phase: number,
  regionWeights: Record<string, number>
): WeatherState {
  let heaviestRegion = 'lumbridge';
  let maxWeight = -Infinity;
  for (const [region, weight] of Object.entries(regionWeights)) {
    if (weight > maxWeight) {
      maxWeight = weight;
      heaviestRegion = region;
    }
  }

  const allowed = WEATHER.filter((w) => w.regions.includes(heaviestRegion));
  const bucket = Math.min(9, Math.max(0, Math.floor(phase * 10)));
  const h = hashBucket(dayIndex, bucket);
  const id = allowed[h % allowed.length].id;

  const prevBucket = bucket === 0 ? 9 : bucket - 1;
  const prevDay = bucket === 0 ? dayIndex - 1 : dayIndex;
  const prevId = allowed[hashBucket(prevDay, prevBucket) % allowed.length].id;

  const blend = id === prevId ? 1 : Math.min(1, Math.max(0, (phase - bucket * 0.1) / 0.02));

  return { id, blend };
}
