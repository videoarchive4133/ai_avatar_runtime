// ── pmxViewer.js ─────────────────────────────────────────────────────────────
// KKBP_Exporter が出力した PMX ファイルを Three.js の Group に変換する。
// PMX はMMD左手系→ Three.js右手系の座標変換が必要。
import { Parser } from 'mmd-parser';
import * as THREE from 'three';

// MMD左手系 → Three.js右手系変換:
//   X を反転、三角形の巻き順を反転（v1とv2を入れ替え）
function convertCoords(positions, normals) {
  for (let i = 0; i < positions.length; i += 3) positions[i] *= -1;
  for (let i = 0; i < normals.length; i += 3)   normals[i]  *= -1;
}

function buildIndices(faces) {
  const arr = new Uint32Array(faces.length * 3);
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i].indices;
    arr[i * 3]     = f[0];
    arr[i * 3 + 1] = f[2]; // 巻き順反転
    arr[i * 3 + 2] = f[1];
  }
  return arr;
}

async function loadTexture(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    new THREE.TextureLoader().load(
      url,
      tex => { URL.revokeObjectURL(url); tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      () => { URL.revokeObjectURL(url); resolve(null); }
    );
  });
}

/**
 * PMX バイナリと（オプションの）テクスチャファイルマップから Three.js Group を生成する。
 * @param {ArrayBuffer} buf  - PMX ファイルのバイナリ
 * @param {Map<string, File>} texMap - 正規化ファイル名 → File のマップ
 * @returns {{ group: THREE.Group, meta: object }}
 */
export async function loadPMXAsGroup(buf, texMap = new Map()) {
  const parser = new Parser();
  const pmx = parser.parsePmx(buf, false); // 座標変換は手動で行う

  const vc = pmx.metadata.vertexCount;
  const positions = new Float32Array(vc * 3);
  const normals   = new Float32Array(vc * 3);
  const uvs       = new Float32Array(vc * 2);

  for (let i = 0; i < vc; i++) {
    const v = pmx.vertices[i];
    positions[i*3]   = v.position[0];
    positions[i*3+1] = v.position[1];
    positions[i*3+2] = v.position[2];
    normals[i*3]   = v.normal[0];
    normals[i*3+1] = v.normal[1];
    normals[i*3+2] = v.normal[2];
    uvs[i*2]   = v.uv[0];
    uvs[i*2+1] = 1 - v.uv[1]; // UVのV軸を反転（MMD→OpenGL系）
  }

  convertCoords(positions, normals);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(buildIndices(pmx.faces), 1));

  // テクスチャをまとめてロード
  const texCache = new Map(); // textureIndex → THREE.Texture | null
  const texLoadPromises = [];
  for (let i = 0; i < pmx.textures.length; i++) {
    const rawName = pmx.textures[i];
    // Windowsパス区切りを正規化してファイル名だけ取り出す
    const baseName = rawName.replace(/\\/g, '/').split('/').pop().toLowerCase();
    // 大文字小文字を無視して検索
    let file = texMap.get(baseName);
    if (!file) {
      for (const [k, v] of texMap) {
        if (k.toLowerCase() === baseName) { file = v; break; }
      }
    }
    const idx = i;
    if (file) {
      texLoadPromises.push(loadTexture(file).then(t => texCache.set(idx, t)));
    } else {
      texCache.set(idx, null);
    }
  }
  await Promise.all(texLoadPromises);

  // マテリアル＋ジオメトリグループを構築
  const materials = [];
  let faceOffset = 0;

  for (const mat of pmx.materials) {
    const [r, g, b, a] = mat.diffuse;
    const threeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      transparent: a < 0.99,
      opacity: a,
      side: THREE.DoubleSide,
      depthWrite: a >= 0.99,
    });

    const tex = texCache.get(mat.textureIndex) ?? null;
    if (tex) {
      threeMat.map = tex;
      // テクスチャがあればdiffuseカラーは白寄りに
      threeMat.color.set(0xffffff);
    }

    geo.addGroup(faceOffset * 3, mat.faceCount * 3, materials.length);
    materials.push(threeMat);
    faceOffset += mat.faceCount;
  }

  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.name = pmx.metadata.modelName || 'PMX Model';
  group.add(mesh);

  const meta = {
    modelName:     pmx.metadata.modelName,
    englishName:   pmx.metadata.englishModelName,
    comment:       pmx.metadata.comment,
    vertexCount:   pmx.metadata.vertexCount,
    faceCount:     pmx.metadata.faceCount,
    materialCount: pmx.metadata.materialCount,
    boneCount:     pmx.metadata.boneCount,
    textureCount:  pmx.metadata.textureCount,
    textures:      pmx.textures,
  };

  return { group, meta };
}

/**
 * File 配列から PMX ファイルとテクスチャマップを抽出する。
 * @param {File[]} files
 * @returns {{ pmxFile: File|null, texMap: Map<string, File> }}
 */
export function extractPMXFiles(files) {
  let pmxFile = null;
  const texMap = new Map();

  for (const f of files) {
    const name = f.name.toLowerCase();
    if (name.endsWith('.pmx')) {
      if (!pmxFile || f.size > pmxFile.size) pmxFile = f; // 最大サイズを選ぶ
    } else {
      texMap.set(f.name.toLowerCase(), f);
    }
  }

  return { pmxFile, texMap };
}
