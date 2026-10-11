import fs from "fs";
import path from "path";

const UNITY = "D:/Low-And-Furious";
const PREFAB = path.join(UNITY, "Assets/_Project/Prefabs/Vehicles/Cars Shop/Getta_Shop.prefab");
const MATERIALS_DIR = path.join(UNITY, "Assets/_Project/Materials");
const TEXTURES_DIR = path.join(UNITY, "Assets/_Project/Textures");
const MODEL = path.join(UNITY, "Assets/_Project/Models/Vehicles/VW Jetta 2015 By FJB.dae");
const OUT = path.resolve("models/Cars/Getta");

const BODY_COLORS = [
  [0.050980393, 0.050980393, 0.050980393],
  [0.14509805, 0.2, 0.3372549],
  [0.26666668, 0.2627451, 0.28235295],
  [0.5254902, 0.5254902, 0.5176471],
  [0.627451, 0.627451, 0.627451],
  [0.5686275, 0.06666667, 0.11764706],
  [0.92941177, 0.92941177, 0.92941177],
  [0.81960785, 0.8117647, 0.85490197],
  [0.45490196, 0.5529412, 0.6313726],
];
const BODY_COLOR = BODY_COLORS[0];
const BODY_MATERIAL = "remapJetta";

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function guidIndex(root, extensions) {
  const index = new Map();
  for (const file of walk(root)) {
    const ext = path.extname(file).toLowerCase();
    if (!extensions.includes(ext)) continue;
    const text = fs.readFileSync(file, "utf8");
    const match = text.match(/^guid: ([0-9a-f]{32})/m);
    if (match) index.set(match[1], file.slice(0, -5));
  }
  return index;
}

function parseBlocks(text) {
  const chunks = text.split(/^--- !u!/m).slice(1);
  return chunks.map((chunk) => {
    const header = chunk.match(/^(\d+) &(-?\d+)/);
    return { type: header ? Number(header[1]) : 0, id: header ? header[2] : "", body: chunk };
  });
}

function field(body, name) {
  const match = body.match(new RegExp(`^  ${name}: (.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function parsePrefab(text) {
  const gameObjects = new Map();
  const transforms = new Map();
  const renderers = [];

  for (const block of parseBlocks(text)) {
    if (block.type === 1) {
      gameObjects.set(block.id, {
        name: (field(block.body, "m_Name") || "").replace(/^"|"$/g, ""),
        active: field(block.body, "m_IsActive") !== "0",
      });
    } else if (block.type === 4) {
      const go = block.body.match(/m_GameObject: \{fileID: (-?\d+)\}/);
      const father = block.body.match(/m_Father: \{fileID: (-?\d+)\}/);
      transforms.set(block.id, {
        gameObject: go ? go[1] : null,
        father: father ? father[1] : "0",
      });
    } else if (block.type === 23) {
      const go = block.body.match(/m_GameObject: \{fileID: (-?\d+)\}/);
      const enabled = !/m_Enabled: 0/.test(block.body);
      const materials = [...block.body.matchAll(/guid: ([0-9a-f]{32})/g)].map((m) => m[1]);
      renderers.push({ gameObject: go ? go[1] : null, enabled, materials });
    }
  }

  const transformByObject = new Map();
  for (const transform of transforms.values()) {
    if (transform.gameObject) transformByObject.set(transform.gameObject, transform);
  }

  function isActive(gameObjectId) {
    const seen = new Set();
    let current = gameObjectId;
    while (current && current !== "0" && !seen.has(current)) {
      seen.add(current);
      const go = gameObjects.get(current);
      if (!go || !go.active) return false;
      const transform = transformByObject.get(current);
      if (!transform || transform.father === "0") break;
      const parent = transforms.get(transform.father);
      current = parent ? parent.gameObject : null;
    }
    return true;
  }

  return renderers.map((renderer) => {
    const go = gameObjects.get(renderer.gameObject);
    return {
      name: go ? go.name : "",
      active: renderer.enabled && isActive(renderer.gameObject),
      materials: renderer.materials,
    };
  }).filter((part) => part.name);
}

function parseColor(body, key) {
  const match = body.match(new RegExp(`${key}: \\{r: ([\\d.eE+-]+), g: ([\\d.eE+-]+), b: ([\\d.eE+-]+), a: ([\\d.eE+-]+)\\}`));
  if (!match) return null;
  return match.slice(1, 5).map(Number);
}

function parseFloatProp(body, key) {
  const match = body.match(new RegExp(`^\\s*- ${key}: ([\\d.eE+-]+)$`, "m"));
  return match ? Number(match[1]) : null;
}

function textureGuid(body, property) {
  const match = body.match(new RegExp(`- ${property}:\\s*\\n\\s*m_Texture: \\{fileID: (-?\\d+), guid: ([0-9a-f]{32})`));
  if (!match || match[1] === "0") return null;
  return match[2];
}

function parseMaterial(file, guid) {
  const text = fs.readFileSync(file, "utf8");
  const material = text.split("--- !u!21")[1] || text;
  const name = (field(material, "m_Name") || path.basename(file, ".mat")).replace(/^"|"$/g, "");
  const base = parseColor(material, "_BaseColor") || [1, 1, 1, 1];
  const color = parseColor(material, "_Color") || base;
  const emission = parseColor(material, "_EmissionColor") || [0, 0, 0, 1];
  const surface = parseFloatProp(material, "_Surface");
  const keywords = [...material.matchAll(/- (_[A-Z0-9_]+)/g)].map((m) => m[1]);
  const transparent = surface === 1 || keywords.some((key) => key.includes("ALPHA") || key.includes("TRANSPARENT"));
  const alphaClip = parseFloatProp(material, "_AlphaClip") === 1 || keywords.includes("_ALPHATEST_ON");
  return {
    guid,
    name,
    color: color.slice(0, 3),
    opacity: transparent ? (base[3] < 1 ? base[3] : color[3]) : 1,
    metallic: parseFloatProp(material, "_Metallic") ?? 0,
    smoothness: parseFloatProp(material, "_Smoothness") ?? parseFloatProp(material, "_Glossiness") ?? 0.5,
    transparent,
    alphaClip,
    cutoff: parseFloatProp(material, "_Cutoff") ?? 0.5,
    cull: parseFloatProp(material, "_Cull") ?? 2,
    emission: emission.slice(0, 3),
    emissionOn: keywords.includes("_EMISSION") && emission.slice(0, 3).some((v) => v > 0),
    map: textureGuid(material, "_BaseMap") || textureGuid(material, "_MainTex"),
    normalMap: textureGuid(material, "_BumpMap"),
    emissionMap: textureGuid(material, "_EmissionMap"),
  };
}

const textureFiles = guidIndex(TEXTURES_DIR, [".meta"]);
const materialFiles = guidIndex(MATERIALS_DIR, [".meta"]);

const parts = parsePrefab(fs.readFileSync(PREFAB, "utf8"));
const usedGuids = [...new Set(parts.flatMap((part) => part.materials))];
const materials = {};
const copied = new Map();

fs.mkdirSync(path.join(OUT, "textures"), { recursive: true });
fs.copyFileSync(MODEL, path.join(OUT, "Getta.dae"));

function copyTexture(guid) {
  if (!guid) return null;
  if (copied.has(guid)) return copied.get(guid);
  const source = textureFiles.get(guid);
  if (!source) {
    console.warn("missing texture", guid);
    copied.set(guid, null);
    return null;
  }
  const filename = path.basename(source).replace(/\s+/g, "_");
  fs.copyFileSync(source, path.join(OUT, "textures", filename));
  const relative = `textures/${filename}`;
  copied.set(guid, relative);
  return relative;
}

for (const guid of usedGuids) {
  const file = materialFiles.get(guid);
  if (!file) {
    console.warn("missing material", guid);
    continue;
  }
  const material = parseMaterial(file, guid);
  if (material.name === BODY_MATERIAL) {
    material.color = BODY_COLOR;
    material.role = "body";
  }
  if (material.name === "CarWindows") material.role = "glass";
  material.map = copyTexture(material.map);
  material.normalMap = copyTexture(material.normalMap);
  material.emissionMap = copyTexture(material.emissionMap);
  delete material.guid;
  materials[guid] = material;
}

const catalog = {
  name: "Getta",
  manufacturer: "Malfada Adel",
  year: 2015,
  price: 45500,
  description: {
    pt: "Um sedã que combina conforto e desempenho, perfeito para quem busca uma direção mais refinada sem abrir mão da potência.",
    en: "A sedan that combines comfort and performance, perfect for those who want a refined drive without giving up power.",
  },
  model: "Getta.dae",
  bodyColor: BODY_COLOR,
  bodyColors: BODY_COLORS,
  materials,
  parts,
};

fs.writeFileSync(path.join(OUT, "getta.json"), JSON.stringify(catalog, null, 2));

const inactive = parts.filter((part) => !part.active).map((part) => part.name);
console.log(JSON.stringify({
  parts: parts.length,
  active: parts.filter((part) => part.active).length,
  inactive,
  materials: Object.values(materials).map((material) => ({
    name: material.name,
    transparent: material.transparent,
    alphaClip: material.alphaClip,
    opacity: material.opacity,
    map: material.map,
    color: material.color,
    metallic: material.metallic,
    smoothness: material.smoothness,
  })),
}, null, 2));
