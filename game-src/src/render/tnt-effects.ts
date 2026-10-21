import * as THREE from "three";
import { TntFuses, type BlockPos, type PrimedTnt } from "../game/tnt";

const BLAST_SECONDS = 0.45;

interface Blast {
  readonly mesh: THREE.Mesh;
  age: number;
  readonly radius: number;
}

/** 着火中のTNTの白い点滅と、爆発の光の玉（WebGL用）。CPU描画のときは使わない。 */
export class TntEffects {
  private readonly scene: THREE.Scene;
  private readonly flashGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);
  private readonly flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  private readonly flashes: THREE.Mesh[] = [];
  private readonly blastGeometry = new THREE.SphereGeometry(1, 20, 14);
  private readonly blasts: Blast[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** 毎フレーム、着火中のTNTぶんの点滅ボックスを置きなおす。 */
  showFuses(primed: readonly PrimedTnt[]): void {
    while (this.flashes.length < primed.length) {
      const mesh = new THREE.Mesh(this.flashGeometry, this.flashMaterial);
      this.scene.add(mesh);
      this.flashes.push(mesh);
    }
    this.flashes.forEach((mesh, i) => {
      const tnt = primed[i];
      mesh.visible = tnt !== undefined && TntFuses.flash(tnt) > 0;
      if (tnt) {
        // 爆発が近づくほどふくらむ
        const grow = 1 + 0.12 * (1 - tnt.remaining / tnt.fuse);
        mesh.position.set(tnt.x + 0.5, tnt.y + 0.5, tnt.z + 0.5);
        mesh.scale.setScalar(grow);
      }
    });
  }

  spawnBlast(center: BlockPos, radius: number): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffb040,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.blastGeometry, material);
    mesh.position.set(center.x + 0.5, center.y + 0.5, center.z + 0.5);
    this.scene.add(mesh);
    this.blasts.push({ mesh, age: 0, radius });
  }

  update(dt: number): void {
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const blast = this.blasts[i];
      if (!blast) continue;
      blast.age += dt;
      const t = blast.age / BLAST_SECONDS;
      if (t >= 1) {
        this.scene.remove(blast.mesh);
        (blast.mesh.material as THREE.Material).dispose();
        this.blasts.splice(i, 1);
        continue;
      }
      blast.mesh.scale.setScalar(0.5 + blast.radius * 1.1 * Math.sqrt(t));
      (blast.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
    }
  }
}
