import type * as THREE from "three";
import { BlockId } from "../world/blocks";
import type { Chunk } from "../world/chunk";
import { CHUNK_SIZE, worldToChunk } from "../world/coords";
import type { World } from "../world/world";

/** The shader lights this many torches at once (the nearest ones). */
export const MAX_TORCH_LIGHTS = 8;
/** Chunks around the player that are searched for torches. */
const SEARCH_CHUNKS = 2;
/** A chunk's torch list is re-scanned at least this often, in case an edit slipped past. */
const RESCAN_SECONDS = 2;

interface Scan {
  readonly at: number;
  readonly torches: readonly (readonly [number, number, number])[];
}

/** Finds the torches near the player and hands the nearest few to the chunk shader
 * as point lights. Scans are cached per chunk, and dropped when that chunk is edited. */
export class TorchLights {
  private cache = new WeakMap<Chunk, Scan>();

  invalidate(world: World, worldX: number, worldZ: number): void {
    const chunk = world.getChunk(worldToChunk(worldX), worldToChunk(worldZ));
    if (chunk) this.cache.delete(chunk);
  }

  invalidateAll(): void {
    this.cache = new WeakMap();
  }

  update(
    world: World,
    player: { readonly x: number; readonly y: number; readonly z: number },
    material: THREE.ShaderMaterial,
  ): void {
    const now = performance.now() / 1000;
    const pcx = worldToChunk(player.x);
    const pcz = worldToChunk(player.z);
    const found: { x: number; y: number; z: number; d: number }[] = [];

    for (let dx = -SEARCH_CHUNKS; dx <= SEARCH_CHUNKS; dx++) {
      for (let dz = -SEARCH_CHUNKS; dz <= SEARCH_CHUNKS; dz++) {
        const chunk = world.getChunk(pcx + dx, pcz + dz);
        if (!chunk) continue;
        let scan = this.cache.get(chunk);
        if (!scan || now - scan.at > RESCAN_SECONDS) {
          scan = { at: now, torches: chunk.findBlocks(BlockId.TORCH) };
          this.cache.set(chunk, scan);
        }
        for (const [lx, ly, lz] of scan.torches) {
          const x = chunk.cx * CHUNK_SIZE + lx + 0.5;
          const y = ly + 0.7;
          const z = chunk.cz * CHUNK_SIZE + lz + 0.5;
          found.push({ x, y, z, d: (x - player.x) ** 2 + (y - player.y) ** 2 + (z - player.z) ** 2 });
        }
      }
    }

    found.sort((a, b) => a.d - b.d);
    const lights = material.uniforms.uTorch?.value as THREE.Vector3[] | undefined;
    const count = Math.min(found.length, MAX_TORCH_LIGHTS);
    if (lights) {
      for (let i = 0; i < count; i++) {
        const t = found[i];
        if (t) lights[i]?.set(t.x, t.y, t.z);
      }
    }
    if (material.uniforms.uTorchCount) material.uniforms.uTorchCount.value = count;
  }
}
