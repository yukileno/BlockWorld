import { describe, expect, it } from "vitest";
import { BlockId } from "./blocks";
import { CHUNK_HEIGHT, CHUNK_SIZE } from "./coords";
import {
  createCaveSampler,
  createColumnSampler,
  DIRT_DEPTH,
  FLAT_HEIGHT,
  generateChunk,
} from "./terrain";

describe("createColumnSampler (superflat)", () => {
  it("is deterministic and produces flat height 64 everywhere", () => {
    const a = createColumnSampler(42);
    const b = createColumnSampler(2026);
    expect(a(100, -50)).toEqual({
      terrainHeight: FLAT_HEIGHT,
      isDesert: false,
      isSnowy: false,
    });
    expect(b(0, 0)).toEqual(a(100, -50));
  });

  it("keeps terrain height within the chunk's vertical bounds", () => {
    const sample = createColumnSampler(2026);
    for (let x = -200; x < 200; x += 37) {
      for (let z = -200; z < 200; z += 43) {
        const { terrainHeight } = sample(x, z);
        expect(terrainHeight).toBe(FLAT_HEIGHT);
      }
    }
  });
});

describe("createCaveSampler (superflat)", () => {
  it("never carves caves in flat creative mode", () => {
    const isCave = createCaveSampler(42);
    for (let x = -20; x < 20; x += 5) {
      for (let y = 0; y < CHUNK_HEIGHT; y += 8) {
        for (let z = -20; z < 20; z += 5) {
          expect(isCave(x, y, z)).toBe(false);
        }
      }
    }
  });
});

describe("generateChunk determinism (superflat)", () => {
  it("generates uniform flat terrain buffer across chunks and seeds", () => {
    const a = generateChunk(3, -2, 42);
    const b = generateChunk(0, 0, 2026);
    expect(a.buffer).toEqual(b.buffer);
  });
});

describe("generateChunk layering (superflat)", () => {
  const seed = 2026;
  const chunk = generateChunk(0, 0, seed);

  it("has bedrock at y=0", () => {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        expect(chunk.getBlock(lx, 0, lz)).toBe(BlockId.BEDROCK);
      }
    }
  });

  it("has stone from y=1 to y=59", () => {
    for (let lx = 0; lx < CHUNK_SIZE; lx += 4) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 4) {
        for (let y = 1; y < FLAT_HEIGHT - DIRT_DEPTH; y++) {
          expect(chunk.getBlock(lx, y, lz)).toBe(BlockId.STONE);
        }
      }
    }
  });

  it("has dirt from y=60 to y=63", () => {
    for (let lx = 0; lx < CHUNK_SIZE; lx += 4) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 4) {
        for (let y = FLAT_HEIGHT - DIRT_DEPTH; y < FLAT_HEIGHT; y++) {
          expect(chunk.getBlock(lx, y, lz)).toBe(BlockId.DIRT);
        }
      }
    }
  });

  it("has grass at y=64 surface", () => {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        expect(chunk.getBlock(lx, FLAT_HEIGHT, lz)).toBe(BlockId.GRASS);
      }
    }
  });

  it("has air from y=65 upwards", () => {
    for (let lx = 0; lx < CHUNK_SIZE; lx += 4) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 4) {
        for (let y = FLAT_HEIGHT + 1; y < CHUNK_HEIGHT; y++) {
          expect(chunk.getBlock(lx, y, lz)).toBe(BlockId.AIR);
        }
      }
    }
  });
});
