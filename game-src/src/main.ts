import "./style.css";
import * as THREE from "three";
import { ChunkMeshManager } from "./render/chunk-mesh-manager";
import { createChunkMaterial, updateChunkMaterial } from "./render/chunk-material";
import { Clouds } from "./render/clouds";
import { CpuRenderer } from "./render/cpu-renderer";
import { createGameScene } from "./render/scene";
import { DAY_LENGTH_SECONDS, STARTUP_PHASE, skyStateAt } from "./render/sky";
import { createBlockTextureArray, createTextureAtlas } from "./render/texture-atlas";
import { BuildTimer } from "./game/build-timer";
import { TNT_BLAST_RADIUS, TntFuses, explode } from "./game/tnt";
import { TntEffects } from "./render/tnt-effects";
import { PlayerController } from "./player/controller";
import { PlayerPositionStore } from "./player/position-store";
import { BlockInteraction } from "./player/interaction";
import { Hotbar } from "./ui/hotbar";
import { Hud } from "./ui/hud";
import { Inventory } from "./ui/inventory";
import { TeleportModal } from "./ui/teleport-modal";
import { isTouchDevice, TouchControls } from "./ui/touch-controls";
import { EditStore } from "./world/edit-store";
import { findPleasantSpawn } from "./world/spawn";
import { BlockId, isSolid } from "./world/blocks";
import { CHUNK_HEIGHT, affectedChunkCoords, chunkKey } from "./world/coords";
import { findGroundHeight } from "./player/physics";
import {
  type ChunkGenerator,
  ChunkStreamer,
  createSyncGenerator,
  createWorkerGenerator,
} from "./world/streamer";
import { World } from "./world/world";

const DEFAULT_SEED = 2026;
const STREAM_RADIUS_WEBGL = 9; // greedy meshing makes the extra draw distance affordable
const STREAM_RADIUS_CPU = 4; // rays reach ~52 blocks; a tighter ring is plenty
const WARMUP_RADIUS_CHUNKS = 2;
const MESH_BUDGET_PER_FRAME = 3;

// Read-only debug handle for the visual-check harness (scripts/visual-check.mjs):
// lets an automated browser assert on game state instead of guessing from pixels.
declare global {
  interface Window {
    __mc?: {
      position: () => { x: number; y: number; z: number };
      blockAt: (x: number, y: number, z: number) => number;
      target: () => { x: number; y: number; z: number } | null;
      pitch: () => number;
      mode: () => string;
      renderer: () => "webgl" | "cpu";
      touch: () => boolean;
      loadedChunks: () => number;
      meshedChunks: () => number;
      pendingChunks: () => number;
      seed: number;
    };
  }
}

/** A dead "Click to play" button is the worst failure mode a browser game
 * can have. If anything at all goes wrong during boot — and the WebGL and
 * worker paths already have their own fallbacks — say so, visibly, in the
 * overlay the player is already looking at. */
function showFatalError(error: unknown): void {
  const content = document.querySelector("#overlay-content");
  if (!content) return;
  const message = error instanceof Error ? error.message : String(error);
  content.innerHTML = "";
  const title = document.createElement("h1");
  title.textContent = "the game couldn't start";
  const detail = document.createElement("p");
  detail.textContent = message;
  const hint = document.createElement("p");
  hint.textContent =
    "Try a hard refresh (Ctrl+Shift+R) or another browser (Chrome/Firefox). " +
    "If it keeps happening, please open an issue with this exact message.";
  content.append(title, detail, hint);
}

/** What the game loop needs from a renderer — satisfied by the Three.js
 * scene when WebGL exists, and by the CPU raycaster when it doesn't. */
interface GameView {
  readonly kind: "webgl" | "cpu";
  readonly camera: THREE.PerspectiveCamera;
  readonly domElement: HTMLElement;
  render(elapsedSeconds: number): void;
  resize(width: number, height: number): void;
  applySky(state: ReturnType<typeof skyStateAt>): void;
  /** Optional adaptive quality hook (WebGL scales its pixel ratio; the CPU
   * renderer already adapts its own internal resolution). */
  tickAdaptive?(frameMs: number): void;
  /** A short label for the HUD describing the current quality target. */
  qualityNote(): string;
}

/** 算数の問題を解いて、ブロックとあそび時間をためて遊ぶモード（無限モードはなし）。 */
function isInfiniteMode(): boolean {
  return false;
}

function boot(): void {
  const infiniteMode = isInfiniteMode();
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app not found");
  const hotbarContainer = document.querySelector<HTMLDivElement>("#hotbar");
  if (!hotbarContainer) throw new Error("#hotbar not found");

  // A shareable world: ?seed=1234 loads the same terrain for everyone.
  const seedParam = new URLSearchParams(window.location.search).get("seed");
  const parsedSeed = seedParam === null ? NaN : Number.parseInt(seedParam, 10);
  const SEED = Number.isFinite(parsedSeed) ? parsedSeed : DEFAULT_SEED;

  const world = new World(SEED);
  const atlas = createTextureAtlas(SEED);

  // The renderer: WebGL when the browser can, an in-house CPU raycaster
  // when it can't. Same world, same physics, same controls either way.
  let view: GameView;
  let chunkMeshes: ChunkMeshManager | null = null;
  let clouds: Clouds | null = null;
  let highlight: THREE.LineSegments | null = null;
  let tntEffects: TntEffects | null = null;
  let cpuView: CpuRenderer | null = null;
  try {
    const gameScene = createGameScene(app);
    const chunkMaterial = createChunkMaterial(createBlockTextureArray(SEED));
    view = {
      kind: "webgl",
      camera: gameScene.camera,
      domElement: gameScene.renderer.domElement,
      render: () => {
        gameScene.render();
      },
      resize: gameScene.resize,
      applySky: (state) => {
        gameScene.applySky(state);
        updateChunkMaterial(chunkMaterial, state);
      },
      tickAdaptive: gameScene.tickAdaptive,
      qualityNote: () => `${Math.round(gameScene.pixelRatio() * 100)}% scale`,
    };
    chunkMeshes = new ChunkMeshManager(gameScene.scene, world, chunkMaterial);
    clouds = new Clouds(gameScene.scene, SEED);
    highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    );
    highlight.visible = false;
    gameScene.scene.add(highlight);
    tntEffects = new TntEffects(gameScene.scene);
  } catch (webglError) {
    console.warn("WebGL unavailable, switching to the CPU raycaster:", webglError);
    const cpu = new CpuRenderer(app, world, SEED);
    cpuView = cpu;
    view = {
      kind: "cpu",
      camera: cpu.camera,
      domElement: cpu.domElement,
      render: (elapsed) => {
        cpu.render(elapsed);
      },
      resize: (w, h) => {
        cpu.resize(w, h);
      },
      applySky: (state) => {
        cpu.applySky(state);
      },
      qualityNote: () => `cpu ${cpu.internalWidth.toString()}p`,
    };
  }

  const editStore = new EditStore(window.localStorage, SEED);
  const positionStore = new PlayerPositionStore(SEED);
  const streamer = new ChunkStreamer(world, {
    radius: view.kind === "webgl" ? STREAM_RADIUS_WEBGL : STREAM_RADIUS_CPU,
    editStore,
    onUnload: (cx, cz) => {
      chunkMeshes?.removeChunkMesh(cx, cz);
    },
  });
  const receive = (cx: number, cz: number, buffer: Uint8Array): void => {
    streamer.receive(cx, cz, buffer);
  };
  let generator: ChunkGenerator;
  try {
    if (typeof Worker === "undefined") throw new Error("workers unavailable");
    generator = createWorkerGenerator(SEED, receive);
  } catch {
    // No module workers? Generate on the main thread — slower on chunk
    // arrival, but the game works everywhere.
    generator = createSyncGenerator(SEED, receive);
  }
  streamer.attachGenerator(generator);

  const spawn = findPleasantSpawn(SEED);
  const savedTransform = positionStore.load();
  const startX = savedTransform?.x ?? spawn.x;
  const startZ = savedTransform?.z ?? spawn.z;
  // Ground under the player's feet before the first frame; the rest streams in.
  streamer.warmUp(startX, startZ, WARMUP_RADIUS_CHUNKS);

  const player = new PlayerController(
    view.camera,
    view.domElement,
    world,
    spawn.x,
    spawn.z,
    savedTransform,
  );

  const savePlayerPosition = (): void => {
    if (player.position.y >= 0 && player.position.y <= 256) {
      positionStore.save(player.transform);
    }
  };

  window.addEventListener("beforeunload", () => {
    savePlayerPosition();
  });
  window.addEventListener("pagehide", () => {
    savePlayerPosition();
  });
  player.onEnterIdle = () => {
    savePlayerPosition();
  };

  const hotbar = new Hotbar(hotbarContainer, atlas.canvas, infiniteMode);
  const inventory = new Inventory(app, hotbar, atlas.canvas, infiniteMode);
  const teleportModal = new TeleportModal(app, () => ({
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
  }));

  inventory.onToggle = (isOpen) => {
    player.setInventoryOpen(isOpen || teleportModal.isOpen);
    if (isOpen) {
      savePlayerPosition();
    }
  };
  teleportModal.onToggle = (isOpen) => {
    player.setInventoryOpen(isOpen || inventory.isOpen);
    if (isOpen) {
      savePlayerPosition();
    }
  };

  teleportModal.onTeleport = (target) => {
    if (target === "spawn") {
      player.respawn(spawn.x, spawn.z);
      savePlayerPosition();
      showToast(`📍 スタート地点 (${spawn.x}, ${spawn.z}) にテレポートしました！`);
      if (!player.isActive) player.requestControl();
      return;
    }
    if (target === "top") {
      const cur = player.position;
      const groundY = findGroundHeight(
        Math.floor(cur.x),
        Math.floor(cur.z),
        CHUNK_HEIGHT - 1,
        (bx, by, bz) => isSolid(world.getBlock(bx, by, bz)),
      );
      player.teleport(cur.x, groundY, cur.z);
      savePlayerPosition();
      showToast(`📍 地表 (Y: ${groundY}) にテレポートしました！`);
      if (!player.isActive) player.requestControl();
      return;
    }
    const { x, z } = target;
    const y =
      target.y ??
      findGroundHeight(Math.floor(x), Math.floor(z), CHUNK_HEIGHT - 1, (bx, by, bz) =>
        isSolid(world.getBlock(bx, by, bz)),
      );
    streamer.warmUp(x, z, WARMUP_RADIUS_CHUNKS);
    player.teleport(x, y, z);
    savePlayerPosition();
    showToast(`📍 (${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)}) にテレポートしました！`);
    if (!player.isActive) player.requestControl();
  };

  hotbar.onOpenInventory = () => {
    teleportModal.close();
    inventory.open();
  };

  // Overlay Screens & Navigation
  const overlay = document.querySelector<HTMLDivElement>("#overlay");
  const screenModeSelect = document.querySelector<HTMLDivElement>("#screen-mode-select");
  const screenControlsGuide = document.querySelector<HTMLDivElement>("#screen-controls-guide");

  const screenNoTime = document.querySelector<HTMLDivElement>("#screen-notime");
  const noTimeMessage = document.querySelector<HTMLParagraphElement>("#notime-message");
  const timer = new BuildTimer(window.localStorage);
  let timerShown = -1;
  const renderTimer = (): void => {
    const el = document.querySelector<HTMLElement>("#build-timer");
    if (!el) return;
    const sec = timer.remainingSeconds;
    if (sec === timerShown) return;
    timerShown = sec;
    el.textContent = `⏱ のこり ${timer.formattedTime}`;
    el.classList.toggle("warn", timer.isWarning);
    el.classList.toggle("empty", !timer.hasTime());
  };

  function showNoTime(timeUp: boolean): void {
    if (noTimeMessage) {
      noTimeMessage.textContent = timeUp
        ? "⏰ じかんぎれ！ もんだいを解いて、またじかんとブロックをゲットしよう！"
        : "まずは もんだいを解いて、あそぶ時間（さいだい3分）とブロックをためよう！";
    }
    screenModeSelect?.classList.add("hidden");
    screenControlsGuide?.classList.add("hidden");
    screenNoTime?.classList.remove("hidden");
    overlay?.classList.remove("hidden");
  }

  function showModeSelect(): void {
    screenNoTime?.classList.add("hidden");
    screenControlsGuide?.classList.add("hidden");
    screenModeSelect?.classList.remove("hidden");
    overlay?.classList.remove("hidden");
  }

  function showControlsGuide(): void {
    if (!timer.hasTime()) {
      showNoTime(false);
      return;
    }
    screenNoTime?.classList.add("hidden");
    screenModeSelect?.classList.add("hidden");
    screenControlsGuide?.classList.remove("hidden");
    overlay?.classList.remove("hidden");
  }

  // 1. Initial screen button
  document.querySelector("#btn-start-build")?.addEventListener("click", () => {
    showControlsGuide();
  });

  // 2. Controls Guide buttons
  document.querySelector("#btn-guide-back")?.addEventListener("click", () => {
    showModeSelect();
  });

  document.querySelector("#btn-enter-world")?.addEventListener("click", () => {
    if (!timer.hasTime()) {
      showNoTime(false);
      return;
    }
    overlay?.classList.add("hidden");
    player.requestControl();
  });

  // When player exits pointer lock / goes idle, show controls guide (pause screen)
  player.onEnterIdle = () => {
    savePlayerPosition();
    if (!timer.hasTime()) {
      showNoTime(true);
    } else if (!inventory.isOpen && !teleportModal.isOpen) {
      showControlsGuide();
    }
  };

  timer.onTimeUp = () => {
    savePlayerPosition();
    inventory.close();
    teleportModal.close();
    player.exitControl();
    showNoTime(true);
  };

  // Top Mode Switcher Bar
  const modeSwitcher = document.createElement("div");
  modeSwitcher.id = "mode-switcher";
  modeSwitcher.className = "mode-switcher";

  modeSwitcher.innerHTML = `
    <span class="mode-debug-badge" style="background:#27ae60; color:#fff; padding:6px 14px; border-radius:6px; font-size:13px; font-weight:bold; letter-spacing:0.5px; box-shadow:0 2px 4px rgba(0,0,0,0.3);">🧱 ブロックわーるど</span>
    <span id="build-timer" class="build-timer" title="あそべる時間（もんだいを解くとふえるよ）">⏱ --:--</span>
    <button type="button" id="btn-mode-teleport" class="mode-btn mode-btn-tp" title="指定した座標へいどう (/tp)">📍 テレポート</button>
    <button type="button" id="btn-mode-help" class="mode-btn mode-btn-help" title="動かし方を見る">❓ そうさ方法</button>
    <a href="../#quiz" class="mode-btn" style="text-decoration:none; display:flex; align-items:center; background:#8e44ad; color:#fff; font-size:12px; margin-left:auto;" title="もんだいにもどる">✏️ もんだいへ</a>
  `;
  app.appendChild(modeSwitcher);

  document.querySelector("#btn-mode-teleport")?.addEventListener("click", (e) => {
    e.stopPropagation();
    inventory.close();
    teleportModal.open("/tp ");
  });

  document.querySelector("#btn-mode-help")?.addEventListener("click", (e) => {
    e.stopPropagation();
    inventory.close();
    teleportModal.close();
    player.exitControl();
    showControlsGuide();
  });
  const interaction = new BlockInteraction(
    view.camera,
    view.domElement,
    world,
    chunkMeshes ?? { updateChunk: () => undefined },
    hotbar,
    player,
  );
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(msg: string): void {
    let toast = document.querySelector<HTMLDivElement>("#game-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "game-toast";
      toast.className = "game-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  interaction.onNoBlocksAvailable = () => {
    showToast("ブロックを持っていないよ！ ✏️もんだいを解いてゲットしよう！");
  };

  interaction.onBlockCollected = (id) => {
    hotbar.addBlock(id, 1);
  };

  interaction.onEdit = (x, y, z, id) => {
    editStore.record(x, y, z, id);
  };

  // TNT: F key / 🔥 button lights it, and a blast sets neighbouring TNT off in a chain.
  const fuses = new TntFuses();
  interaction.onIgnite = (x, y, z) => {
    if (fuses.ignite(x, y, z)) showToast("🔥 ひがついた！ はなれて〜！");
  };
  const detonate = (x: number, y: number, z: number): void => {
    const blast = explode(
      { x, y, z },
      (bx, by, bz) => world.getBlock(bx, by, bz),
      (bx, by, bz, id) => {
        world.setBlock(bx, by, bz, id);
      },
      CHUNK_HEIGHT,
      TNT_BLAST_RADIUS,
    );
    editStore.recordMany(blast.destroyed.map((c) => ({ ...c, id: BlockId.AIR })));
    for (const c of blast.chained) fuses.igniteChain(c.x, c.y, c.z);
    const dirty = new Map<string, { cx: number; cz: number }>();
    for (const c of blast.destroyed) {
      for (const chunk of affectedChunkCoords(c.x, c.z)) {
        dirty.set(chunkKey(chunk.cx, chunk.cz), chunk);
      }
    }
    for (const { cx, cz } of dirty.values()) {
      chunkMeshes?.updateChunk(cx, cz);
    }
    tntEffects?.spawnBlast(blast.center, TNT_BLAST_RADIUS);
  };

  // On-screen controls for touch devices and Chromebooks — joystick, action buttons.
  const touchControls = new TouchControls(app, {
    isActive: () => player.isActive,
    onInput: (input) => {
      player.setExternalInput(input);
    },
    onLook: (dx, dy) => {
      player.lookBy(dx, dy);
    },
    onBreak: () => {
      interaction.breakTargetedBlock();
    },
    onPlace: () => {
      interaction.placeTargetedBlock();
    },
    onIgnite: () => {
      interaction.igniteTargetedBlock();
    },
  });
  let touchVisible = false;

  const hud = new Hud(app);
  hud.onClick = () => {
    inventory.close();
    teleportModal.open("/tp ");
  };

  // Keyboard shortcuts for command / teleport: Slash (/) or KeyT (t)
  window.addEventListener("keydown", (e) => {
    if (teleportModal.isOpen || inventory.isOpen) return;
    if (!player.isActive) return;
    if (e.code === "Slash" || e.key === "/" || e.key === "／") {
      e.preventDefault();
      inventory.close();
      teleportModal.open("/tp ");
    } else if (e.code === "KeyT") {
      e.preventDefault();
      inventory.close();
      teleportModal.open("/tp ");
    }
  });

  window.addEventListener("resize", () => {
    view.resize(window.innerWidth, window.innerHeight);
  });

  window.__mc = {
    position: () => ({ ...player.position }),
    blockAt: (x, y, z) => world.getBlock(x, y, z),
    target: () => {
      const hit = interaction.raycastFromCamera();
      return hit ? { x: hit.blockX, y: hit.blockY, z: hit.blockZ } : null;
    },
    pitch: () => player.eyePitch,
    mode: () => player.mode,
    renderer: () => view.kind,
    touch: () => isTouchDevice(),
    loadedChunks: () => world.loadedChunkCount,
    meshedChunks: () => chunkMeshes?.meshedChunkCount ?? world.loadedChunkCount,
    pendingChunks: () => streamer.pendingCount,
    seed: SEED,
  };

  const startedAt = performance.now();
  let lastTime = startedAt;
  let lastPositionSaveTime = 0;
  const frame = (time: number): void => {
    const frameDelta = time - lastTime;
    const dt = Math.min(frameDelta / 1000, 0.1); // clamp to avoid a huge step after a tab switch
    lastTime = time;
    const elapsed = (time - startedAt) / 1000 + STARTUP_PHASE * DAY_LENGTH_SECONDS;

    // Adaptive quality: feed the real frame cadence so the renderer can
    // trade resolution for a fluid frame rate on weaker (mobile) hardware.
    view.tickAdaptive?.(frameDelta);

    if (player.isActive !== touchVisible) {
      touchVisible = player.isActive;
      touchControls.setVisible(touchVisible);
    }

    streamer.update(player.position.x, player.position.z);
    player.update(dt);

    // あそび時間は、実際にワールドを操作している間だけへる（持ち物や一時停止中は止まる）
    if (player.isActive && !inventory.isOpen && !teleportModal.isOpen) {
      timer.tick(dt);
    }
    renderTimer();

    // 奈落落下安全ネット (Void Safety Net)
    if (player.position.y < -20) {
      player.respawn(spawn.x, spawn.z);
      savePlayerPosition();
    }

    // プレイヤー位置の定期保存（1秒間隔）
    lastPositionSaveTime += dt;
    if (lastPositionSaveTime >= 1.0) {
      lastPositionSaveTime = 0;
      timer.save();
      if (player.isActive) {
        savePlayerPosition();
      }
    }

    for (const { cx, cz } of streamer.drainDirty(MESH_BUDGET_PER_FRAME)) {
      chunkMeshes?.updateChunk(cx, cz);
    }

    // 着火中のTNT：あそび中だけ時間が進む（もちもの・一時停止中はヒューズも止まる）
    if (player.isActive && !inventory.isOpen && !teleportModal.isOpen) {
      const due = fuses.tick(dt, (bx, by, bz) => world.getBlock(bx, by, bz) === BlockId.TNT);
      for (const tnt of due) detonate(tnt.x, tnt.y, tnt.z);
    }
    tntEffects?.showFuses(fuses.active);
    tntEffects?.update(dt);

    view.applySky(skyStateAt(elapsed));
    clouds?.update(player.position.x, player.position.z, elapsed);

    const hit = interaction.raycastFromCamera();
    if (highlight) {
      highlight.visible = hit !== null;
      if (hit) {
        highlight.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
      }
    }
    cpuView?.setHighlight(hit ? { x: hit.blockX, y: hit.blockY, z: hit.blockZ } : null);

    hud.frame(time, {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      chunks: world.loadedChunkCount,
      seed: SEED,
      note: view.qualityNote(),
    });

    view.render(elapsed);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

try {
  boot();
} catch (error) {
  console.error(error);
  showFatalError(error);
}
