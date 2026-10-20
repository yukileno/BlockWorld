import { BlockId } from "./blocks";
import { Chunk } from "./chunk";
import { CHUNK_HEIGHT, CHUNK_SIZE } from "./coords";

export const DIRT_DEPTH = 4;
export const FLAT_HEIGHT = 64;

export interface ColumnProfile {
  readonly terrainHeight: number;
  readonly isDesert: boolean;
  readonly isSnowy: boolean;
}

/** Superflat column sampler: perfectly flat grassy plain across the entire world. */
export function createColumnSampler(
  _seed: number,
): (worldX: number, worldZ: number) => ColumnProfile {
  return (): ColumnProfile => ({
    terrainHeight: FLAT_HEIGHT,
    isDesert: false,
    isSnowy: false,
  });
}

export type CaveQuery = (worldX: number, worldY: number, worldZ: number) => boolean;

/** No caves in superflat creative mode so the ground stays solid. */
export function createCaveSampler(_seed: number): CaveQuery {
  return (): boolean => false;
}

function surfaceBlock(_profile: ColumnProfile): BlockId {
  return BlockId.GRASS;
}

function subsurfaceBlock(_profile: ColumnProfile): BlockId {
  return BlockId.DIRT;
}

/** Fills one column of a chunk for superflat world:
 * y=0: Bedrock
 * y=1..59: Stone
 * y=60..63: Dirt
 * y=64: Grass
 * y>=65: Air */
function fillColumn(
  chunk: Chunk,
  lx: number,
  lz: number,
  _worldX: number,
  _worldZ: number,
  profile: ColumnProfile,
  _isCave: CaveQuery,
): void {
  const { terrainHeight } = profile;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    let id: BlockId;
    if (y === 0) {
      id = BlockId.BEDROCK;
    } else if (y < terrainHeight - DIRT_DEPTH) {
      id = BlockId.STONE;
    } else if (y < terrainHeight) {
      id = subsurfaceBlock(profile);
    } else if (y === terrainHeight) {
      id = surfaceBlock(profile);
    } else {
      id = BlockId.AIR;
    }

    chunk.setBlock(lx, y, lz, id);
  }
}

/** No trees in flat creative building world for clean canvas. */
function stampTrees(
  _chunk: Chunk,
  _seed: number,
  _sampleColumn: (x: number, z: number) => ColumnProfile,
  _isCave: CaveQuery,
): void {
  // Intentionally empty for flat building canvas
}

export function generateChunk(cx: number, cz: number, seed: number): Chunk {
  const chunk = new Chunk(cx, cz);
  const sampleColumn = createColumnSampler(seed);
  const isCave = createCaveSampler(seed);
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const worldX = originX + lx;
      const worldZ = originZ + lz;
      const profile = sampleColumn(worldX, worldZ);
      fillColumn(chunk, lx, lz, worldX, worldZ, profile, isCave);
    }
  }

  stampTrees(chunk, seed, sampleColumn, isCave);

  return chunk;
}
