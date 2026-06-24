/**
 * KoiKatsuキャラクターアセンブラー
 *
 * 【設計方針】
 * GLBシーン全体を identity のまま this.root に追加する。
 * スケール変換を一切かけないことで、スキニングの二重適用を根本から回避する。
 *   bone.matrixWorld = bone.local  (シーンが identity なので)
 *   IBM = inv(bone.local_at_bind)  ≈ inv(bone.local)  (レストポーズ時)
 *   boneMatrix = bone.local * inv(bone.local) = I
 *   skinned = I * vertex = vertex  ← ジオメトリ座標でそのまま表示
 *   gl_Position = proj * view * identity * vertex  ← 二重適用なし ✓
 *
 * キャラは高さ約 1.5 units (y=0.015〜1.525)。カメラはそれに合わせて設定済み。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

function loadGLB(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, gltf => resolve(gltf.scene), undefined, reject);
  });
}

function buildBoneMap(root) {
  const map = {};
  root.traverse(obj => { if (obj.name) map[obj.name] = obj; });
  return map;
}

// KoiKatsuデフォルト肌色 (白テクスチャへのティント)
const SKIN_COLOR    = new THREE.Color(0xF0C8A5); // 標準肌色
const SKIN_SLOTS    = new Set(['body', 'head', 'hair_front', 'hair_back', 'hair_ahoge']); // 肌色適用スロット
const HAIR_COLOR    = new THREE.Color(0x2a1a0a); // デフォルト黒髪

// 服装スロット以外に肌色/髪色を自動適用
function applyDefaultColor(group, slot) {
  group.traverse(obj => {
    if (!obj.isMesh && !obj.isSkinnedMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(m => {
      if (!m) return;
      if (slot === 'body' || slot === 'head') {
        m.color.set(SKIN_COLOR);
      } else if (slot === 'hair_front' || slot === 'hair_back' || slot === 'hair_ahoge') {
        m.color.set(HAIR_COLOR);
      }
    });
  });
}

function setupMeshes(group) {
  group.traverse(obj => {
    if (obj.isSkinnedMesh) {
      obj.frustumCulled = false;
      obj.castShadow   = true;
      obj.receiveShadow = true;
    }
  });
}

// パーツのスケルトンをベースボディのボーンにリバインドする
function rebindToBase(skinnedMesh, baseBoneMap) {
  if (!skinnedMesh.skeleton) return 0;
  const oldBones = skinnedMesh.skeleton.bones;
  let matched = 0;
  const newBones = oldBones.map(b => {
    const target = baseBoneMap[b.name];
    if (target) { matched++; return target; }
    return b;
  });
  const newSkeleton = new THREE.Skeleton(newBones, skinnedMesh.skeleton.boneInverses);
  skinnedMesh.bind(newSkeleton, new THREE.Matrix4());
  return matched;
}

export class KKCharacter {
  constructor(scene) {
    this.scene      = scene;
    this.root       = new THREE.Group();
    this.root.name  = 'KK_Character';
    scene.add(this.root);

    this.baseModel  = null;
    this.baseBoneMap = {};
    this.parts      = {};
    this.onProgress = null;
  }

  async loadBase(url = '/models/cf_body_base.glb') {
    this._log('ベースボディ読み込み中...');
    const glbScene = await loadGLB(url);
    setupMeshes(glbScene);
    applyDefaultColor(glbScene, 'body');
    this.root.add(glbScene);
    this.baseModel   = glbScene;
    this.baseBoneMap = buildBoneMap(glbScene);
    this._log('ベースボディ完了');
    return glbScene;
  }

  async attach(slot, url) {
    this.detach(slot);
    if (!url) return;
    this._log(`${slot} 読み込み中...`);
    try {
      const glbScene = await loadGLB(url);
      setupMeshes(glbScene);
      applyDefaultColor(glbScene, slot);
      // ベースボディのボーンにリバインド (名前が一致する分だけ)
      glbScene.traverse(obj => {
        if (obj.isSkinnedMesh) rebindToBase(obj, this.baseBoneMap);
      });
      this.root.add(glbScene);
      this.parts[slot] = glbScene;
      this._log(`${slot} 装着完了`);
    } catch (e) {
      console.error(`attach(${slot}) failed:`, e);
      this._log(`${slot} エラー`);
    }
  }

  detach(slot) {
    const p = this.parts[slot];
    if (!p) return;
    this.root.remove(p);
    p.traverse(obj => {
      obj.geometry?.dispose();
      if (obj.material) {
        (Array.isArray(obj.material) ? obj.material : [obj.material])
          .forEach(m => m?.dispose());
      }
    });
    delete this.parts[slot];
  }

  setColor(slot, hex) {
    const color = new THREE.Color(hex);
    const group = slot === 'body' ? this.baseModel : this.parts[slot];
    if (!group) return;
    group.traverse(obj => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      (Array.isArray(obj.material) ? obj.material : [obj.material])
        .forEach(m => { if (m?.color) m.color.set(color); });
    });
  }

  reset() {
    Object.keys(this.parts).forEach(slot => this.detach(slot));
    if (this.baseModel) {
      this.root.remove(this.baseModel);
      this.baseModel.traverse(obj => {
        obj.geometry?.dispose();
        if (obj.material) {
          (Array.isArray(obj.material) ? obj.material : [obj.material])
            .forEach(m => m?.dispose());
        }
      });
      this.baseModel = null;
    }
    this.baseBoneMap = {};
  }

  _log(msg) { if (this.onProgress) this.onProgress(msg); }
}
