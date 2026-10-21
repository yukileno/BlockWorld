import { describe, expect, it } from "vitest";
import { BLOCKS, BlockId } from "../world/blocks";
import { Chunk } from "../world/chunk";
import { type NeighborLookup, meshChunk } from "./mesher";

const allAir: NeighborLookup = { getBlock: () => BlockId.AIR };

describe("torch", () => {
  it("is walk-through, breakable and see-through", () => {
    const def = BLOCKS[BlockId.TORCH];
    expect(def.solid).toBe(false);
    expect(def.transparent).toBe(true);
    expect(def.breakable).toBe(true);
  });

  it("is found by Chunk.findBlocks", () => {
    const chunk = new Chunk(0, 0);
    chunk.setBlock(3, 40, 5, BlockId.TORCH);
    chunk.setBlock(15, 95, 15, BlockId.TORCH);
    expect(chunk.findBlocks(BlockId.TORCH)).toEqual([
      [3, 40, 5],
      [15, 95, 15],
    ]);
  });

  it("is meshed as a thin 6-face stick, not a full cube", () => {
    const chunk = new Chunk(0, 0);
    chunk.setBlock(4, 10, 4, BlockId.TORCH);
    const mesh = meshChunk(chunk, allAir);
    expect(mesh.indices.length / 6).toBe(6);
    let maxY = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      minX = Math.min(minX, mesh.positions[i] ?? 0);
      maxX = Math.max(maxX, mesh.positions[i] ?? 0);
      maxY = Math.max(maxY, mesh.positions[i + 1] ?? 0);
    }
    expect(maxX - minX).toBeCloseTo(0.125);
    expect(maxY).toBeCloseTo(10.625);
  });

  it("lets the faces of a neighbouring block show next to it", () => {
    const chunk = new Chunk(0, 0);
    chunk.setBlock(4, 10, 4, BlockId.STONE);
    chunk.setBlock(5, 10, 4, BlockId.TORCH);
    const withTorch = meshChunk(chunk, allAir).indices.length / 6;
    // stone's 6 faces (the one toward the torch is not hidden) + the torch's 6
    expect(withTorch).toBe(12);
  });
});
