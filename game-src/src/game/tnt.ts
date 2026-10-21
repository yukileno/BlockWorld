import { BLOCKS, BlockId } from "../world/blocks";

/** 着火してから爆発するまでの時間（秒） */
export const TNT_FUSE_SECONDS = 3;
/** 爆風に巻きこまれたTNTが誘爆するまでの時間（秒）。連鎖がパパパッと続く */
export const TNT_CHAIN_FUSE_MIN = 0.3;
export const TNT_CHAIN_FUSE_MAX = 0.9;
/** 爆発のはんけい（ブロック数） */
export const TNT_BLAST_RADIUS = 3;

export interface BlockPos {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PrimedTnt extends BlockPos {
  /** 爆発までの残り秒数 */
  remaining: number;
  /** 最初に着火した時間（点滅の計算用） */
  readonly fuse: number;
}

export interface Explosion {
  readonly center: BlockPos;
  /** こわれたブロック（TNT自身をふくむ） */
  readonly destroyed: readonly (BlockPos & { readonly id: BlockId })[];
  /** 爆風でいっしょに着火したTNT */
  readonly chained: readonly BlockPos[];
}

export const posKey = (x: number, y: number, z: number): string =>
  `${x.toString()},${y.toString()},${z.toString()}`;

/** 爆発で壊せるブロックか（岩盤・水・空気は壊れない。TNTは壊れず誘爆する） */
function isBlastable(id: BlockId): boolean {
  return id !== BlockId.TNT && BLOCKS[id].breakable;
}

/** 爆風の範囲。中心を中心にした球の中を、すべて対象にする。 */
export function blastCells(center: BlockPos, radius = TNT_BLAST_RADIUS): BlockPos[] {
  const cells: BlockPos[] = [];
  const limit = radius * radius + radius * 0.5; // ちょっと丸みをもたせる
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dy * dy + dz * dz > limit) continue;
        cells.push({ x: center.x + dx, y: center.y + dy, z: center.z + dz });
      }
    }
  }
  return cells;
}

/** 爆発を計算して、ワールドに反映する。反映は `setBlock` 経由（描画の更新は呼び出し側）。 */
export function explode(
  center: BlockPos,
  getBlock: (x: number, y: number, z: number) => BlockId,
  setBlock: (x: number, y: number, z: number, id: BlockId) => void,
  height: number,
  radius = TNT_BLAST_RADIUS,
): Explosion {
  const destroyed: (BlockPos & { id: BlockId })[] = [];
  const chained: BlockPos[] = [];

  for (const cell of blastCells(center, radius)) {
    if (cell.y < 0 || cell.y >= height) continue;
    const id = getBlock(cell.x, cell.y, cell.z);
    const isCenter = cell.x === center.x && cell.y === center.y && cell.z === center.z;
    if (id === BlockId.TNT && !isCenter) {
      chained.push(cell);
    } else if (isCenter || isBlastable(id)) {
      if (id === BlockId.AIR) continue;
      setBlock(cell.x, cell.y, cell.z, BlockId.AIR);
      destroyed.push({ ...cell, id });
    }
  }
  return { center, destroyed, chained };
}

/** 着火中のTNTをまとめて管理する。ワールドや描画は知らない（時間だけ進める）。 */
export class TntFuses {
  private readonly primed = new Map<string, PrimedTnt>();

  get active(): readonly PrimedTnt[] {
    return [...this.primed.values()];
  }

  get count(): number {
    return this.primed.size;
  }

  isPrimed(x: number, y: number, z: number): boolean {
    return this.primed.has(posKey(x, y, z));
  }

  /** 着火する。すでに着火ずみなら何もしない（false）。 */
  ignite(x: number, y: number, z: number, seconds = TNT_FUSE_SECONDS): boolean {
    const key = posKey(x, y, z);
    if (this.primed.has(key)) return false;
    this.primed.set(key, { x, y, z, remaining: seconds, fuse: seconds });
    return true;
  }

  /** 誘爆。すでに着火していて、もっと早く爆発するなら短くする。 */
  igniteChain(x: number, y: number, z: number, rand: () => number = Math.random): void {
    const seconds = TNT_CHAIN_FUSE_MIN + rand() * (TNT_CHAIN_FUSE_MAX - TNT_CHAIN_FUSE_MIN);
    const existing = this.primed.get(posKey(x, y, z));
    if (existing) {
      existing.remaining = Math.min(existing.remaining, seconds);
      return;
    }
    this.ignite(x, y, z, seconds);
  }

  /** 時間を進めて、爆発する時間になったTNTを返す。
   * `stillTnt` が false を返すもの（壊されたなど）は、ヒューズごと消す。 */
  tick(dt: number, stillTnt: (x: number, y: number, z: number) => boolean): PrimedTnt[] {
    const due: PrimedTnt[] = [];
    for (const [key, tnt] of this.primed) {
      if (!stillTnt(tnt.x, tnt.y, tnt.z)) {
        this.primed.delete(key);
        continue;
      }
      tnt.remaining -= dt;
      if (tnt.remaining <= 0) {
        this.primed.delete(key);
        due.push(tnt);
      }
    }
    return due;
  }

  /** 点滅の強さ 0〜1。残り時間が少ないほど速く点滅する。 */
  static flash(tnt: PrimedTnt): number {
    const elapsed = tnt.fuse - tnt.remaining;
    const rate = 4 + 10 * (elapsed / tnt.fuse); // 1秒あたりの点滅回数がふえていく
    return Math.sin(elapsed * rate * Math.PI * 2) > 0 ? 1 : 0;
  }
}
