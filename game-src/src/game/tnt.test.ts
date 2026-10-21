import { describe, expect, it } from "vitest";
import { BlockId } from "../world/blocks";
import { TNT_FUSE_SECONDS, TntFuses, blastCells, explode } from "./tnt";

function makeWorld(fill: BlockId = BlockId.STONE) {
  const cells = new Map<string, BlockId>();
  const key = (x: number, y: number, z: number) =>
    `${x.toString()},${y.toString()},${z.toString()}`;
  return {
    cells,
    get: (x: number, y: number, z: number) => cells.get(key(x, y, z)) ?? fill,
    set: (x: number, y: number, z: number, id: BlockId) => {
      cells.set(key(x, y, z), id);
    },
  };
}

describe("blastCells", () => {
  it("is a ball around the center", () => {
    const cells = blastCells({ x: 0, y: 0, z: 0 }, 3);
    expect(cells).toContainEqual({ x: 0, y: 0, z: 0 });
    expect(cells).toContainEqual({ x: 3, y: 0, z: 0 });
    expect(cells).not.toContainEqual({ x: 3, y: 3, z: 3 });
  });
});

describe("explode", () => {
  it("clears breakable blocks including the TNT itself", () => {
    const w = makeWorld();
    w.set(10, 10, 10, BlockId.TNT);
    const result = explode({ x: 10, y: 10, z: 10 }, w.get, w.set, 96);
    expect(w.get(10, 10, 10)).toBe(BlockId.AIR);
    expect(w.get(12, 10, 10)).toBe(BlockId.AIR);
    expect(w.get(14, 10, 10)).toBe(BlockId.STONE);
    expect(result.destroyed.length).toBeGreaterThan(50);
  });

  it("leaves bedrock and water alone", () => {
    const w = makeWorld(BlockId.AIR);
    w.set(1, 10, 0, BlockId.BEDROCK);
    w.set(0, 11, 0, BlockId.WATER);
    w.set(0, 10, 0, BlockId.TNT);
    explode({ x: 0, y: 10, z: 0 }, w.get, w.set, 96);
    expect(w.get(1, 10, 0)).toBe(BlockId.BEDROCK);
    expect(w.get(0, 11, 0)).toBe(BlockId.WATER);
  });

  it("reports nearby TNT as chained instead of destroying it", () => {
    const w = makeWorld(BlockId.AIR);
    w.set(0, 10, 0, BlockId.TNT);
    w.set(2, 10, 0, BlockId.TNT);
    const result = explode({ x: 0, y: 10, z: 0 }, w.get, w.set, 96);
    expect(result.chained).toEqual([{ x: 2, y: 10, z: 0 }]);
    expect(w.get(2, 10, 0)).toBe(BlockId.TNT);
  });

  it("stays inside the world height", () => {
    const w = makeWorld();
    w.set(0, 1, 0, BlockId.TNT);
    explode({ x: 0, y: 1, z: 0 }, w.get, w.set, 96);
    expect(w.cells.has("0,-1,0")).toBe(false);
  });
});

describe("TntFuses", () => {
  const always = () => true;

  it("explodes after the fuse runs out", () => {
    const fuses = new TntFuses();
    expect(fuses.ignite(1, 2, 3)).toBe(true);
    expect(fuses.tick(TNT_FUSE_SECONDS - 0.5, always)).toHaveLength(0);
    expect(fuses.tick(0.6, always)).toEqual([expect.objectContaining({ x: 1, y: 2, z: 3 })]);
    expect(fuses.count).toBe(0);
  });

  it("ignores a second ignition of the same block", () => {
    const fuses = new TntFuses();
    fuses.ignite(0, 0, 0);
    expect(fuses.ignite(0, 0, 0)).toBe(false);
    expect(fuses.count).toBe(1);
  });

  it("drops a fuse whose block is no longer TNT", () => {
    const fuses = new TntFuses();
    fuses.ignite(0, 0, 0);
    expect(fuses.tick(10, () => false)).toHaveLength(0);
    expect(fuses.count).toBe(0);
  });

  it("a chain ignition only ever shortens a running fuse", () => {
    const fuses = new TntFuses();
    fuses.ignite(0, 0, 0);
    fuses.igniteChain(0, 0, 0, () => 0);
    expect(fuses.active[0]?.remaining).toBeLessThan(TNT_FUSE_SECONDS);
    const short = fuses.active[0]?.remaining ?? 0;
    fuses.igniteChain(0, 0, 0, () => 1);
    expect(fuses.active[0]?.remaining).toBe(short);
  });
});
