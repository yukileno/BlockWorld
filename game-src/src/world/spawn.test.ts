import { describe, expect, it } from "vitest";
import { findPleasantSpawn } from "./spawn";
import { createCaveSampler, createColumnSampler, FLAT_HEIGHT } from "./terrain";

describe("findPleasantSpawn (superflat)", () => {
  it("is deterministic per seed", () => {
    expect(findPleasantSpawn(2026)).toEqual(findPleasantSpawn(2026));
  });

  it("lands on a flat grassy column at (0.5, 0.5)", () => {
    for (const seed of [1, 2, 42, 2026, 987654]) {
      const spawn = findPleasantSpawn(seed);
      expect(spawn.x).toBe(0.5);
      expect(spawn.z).toBe(0.5);

      const profile = createColumnSampler(seed)(Math.floor(spawn.x), Math.floor(spawn.z));
      const isCave = createCaveSampler(seed);

      expect(profile.isDesert).toBe(false);
      expect(profile.isSnowy).toBe(false);
      expect(profile.terrainHeight).toBe(FLAT_HEIGHT);
      expect(isCave(Math.floor(spawn.x), profile.terrainHeight, Math.floor(spawn.z))).toBe(false);
    }
  });

  it("centers the spawn inside its block so the player isn't on an edge", () => {
    const spawn = findPleasantSpawn(2026);
    expect(spawn.x - Math.floor(spawn.x)).toBeCloseTo(0.5);
    expect(spawn.z - Math.floor(spawn.z)).toBeCloseTo(0.5);
  });
});
