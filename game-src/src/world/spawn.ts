export interface SpawnPoint {
  readonly x: number;
  readonly z: number;
}

/** Superflat world spawn point at the center of the world. */
export function findPleasantSpawn(_seed: number): SpawnPoint {
  return { x: 0.5, z: 0.5 };
}
