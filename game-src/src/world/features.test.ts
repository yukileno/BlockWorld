import { describe, expect, it } from "vitest";
import { BlockId } from "./blocks";
import { CHUNK_SIZE } from "./coords";
import {
  CANOPY_RADIUS,
  TREE_CELL_SIZE,
  treeBlocks,
  treeCandidateInCell,
  treeCandidatesNear,
} from "./features";
import { generateChunk } from "./terrain";

describe("treeCandidateInCell", () => {
  it("is deterministic per (seed, cell)", () => {
    for (let cx = -5; cx <= 5; cx++) {
      for (let cz = -5; cz <= 5; cz++) {
        expect(treeCandidateInCell(42, cx, cz)).toEqual(treeCandidateInCell(42, cx, cz));
      }
    }
  });

  it("jitters the tree inside its own cell, so two cells can never collide", () => {
    for (let cx = -20; cx <= 20; cx++) {
      for (let cz = -20; cz <= 20; cz++) {
        const tree = treeCandidateInCell(7, cx, cz);
        if (!tree) continue;
        expect(Math.floor(tree.x / TREE_CELL_SIZE)).toBe(cx);
        expect(Math.floor(tree.z / TREE_CELL_SIZE)).toBe(cz);
      }
    }
  });

  it("produces trees in some cells but not all (density is neither 0 nor 1)", () => {
    let present = 0;
    let total = 0;
    for (let cx = 0; cx < 30; cx++) {
      for (let cz = 0; cz < 30; cz++) {
        total++;
        if (treeCandidateInCell(2026, cx, cz)) present++;
      }
    }
    expect(present).toBeGreaterThan(0);
    expect(present).toBeLessThan(total);
  });

  it("keeps trunk heights within the canopy math's expectations", () => {
    for (let cx = 0; cx < 40; cx++) {
      const tree = treeCandidateInCell(11, cx, 3);
      if (!tree) continue;
      expect(tree.trunkHeight).toBeGreaterThanOrEqual(4);
      expect(tree.trunkHeight).toBeLessThanOrEqual(6);
    }
  });
});

describe("treeCandidatesNear", () => {
  it("includes a tree rooted just outside the rect when its canopy reaches in", () => {
    // Find any tree, then query a rect whose edge is CANOPY_RADIUS away from it.
    let found = false;
    for (let cx = 0; cx < 50 && !found; cx++) {
      const tree = treeCandidateInCell(42, cx, 0);
      if (!tree) continue;
      const rect = treeCandidatesNear(
        42,
        tree.x + CANOPY_RADIUS,
        tree.x + CANOPY_RADIUS + 15,
        tree.z,
        tree.z + 15,
      );
      expect(rect.some((t) => t.x === tree.x && t.z === tree.z)).toBe(true);
      found = true;
    }
    expect(found).toBe(true);
  });

  it("excludes trees too far away to overlap the rect", () => {
    const trees = treeCandidatesNear(42, 0, 15, 0, 15);
    for (const t of trees) {
      expect(t.x).toBeGreaterThanOrEqual(-CANOPY_RADIUS);
      expect(t.x).toBeLessThanOrEqual(15 + CANOPY_RADIUS);
      expect(t.z).toBeGreaterThanOrEqual(-CANOPY_RADIUS);
      expect(t.z).toBeLessThanOrEqual(15 + CANOPY_RADIUS);
    }
  });
});

describe("treeBlocks", () => {
  const tree = { x: 10, z: 20, trunkHeight: 5 };
  const blocks = treeBlocks(tree, 40);

  it("puts the trunk directly above the surface, one block per level", () => {
    const trunk = blocks.filter((b) => b.kind === "trunk");
    expect(trunk).toHaveLength(5);
    expect(trunk.every((b) => b.x === 10 && b.z === 20)).toBe(true);
    expect(trunk.map((b) => b.y).sort((a, b) => a - b)).toEqual([41, 42, 43, 44, 45]);
  });

  it("never emits a leaf in a trunk cell", () => {
    const trunkCells = new Set(
      blocks
        .filter((b) => b.kind === "trunk")
        .map((b) => `${b.x.toString()},${b.y.toString()},${b.z.toString()}`),
    );
    for (const b of blocks) {
      if (b.kind === "leaves") {
        expect(trunkCells.has(`${b.x.toString()},${b.y.toString()},${b.z.toString()}`)).toBe(false);
      }
    }
  });

  it("keeps the canopy within CANOPY_RADIUS of the trunk", () => {
    for (const b of blocks) {
      expect(Math.abs(b.x - tree.x)).toBeLessThanOrEqual(CANOPY_RADIUS);
      expect(Math.abs(b.z - tree.z)).toBeLessThanOrEqual(CANOPY_RADIUS);
    }
  });
});

describe("trees in generated chunks (superflat creative)", () => {
  const seed = 2026;

  it("does not stamp any natural trees into generated chunks to keep the canvas clean", () => {
    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        const chunk = generateChunk(cx, cz, seed);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            // Above ground (y > 64) must only be AIR
            for (let y = 65; y < 100; y++) {
              expect(chunk.getBlock(lx, y, lz)).toBe(BlockId.AIR);
            }
          }
        }
      }
    }
  });
});
