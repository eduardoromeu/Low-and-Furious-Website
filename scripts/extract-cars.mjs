import fs from "fs";
import path from "path";

const UNITY = "D:/Low-And-Furious";
const PROJECT = path.join(UNITY, "Assets/_Project");
const SITE = path.resolve("models/Cars");

const CARS = [
  {
    id: "kuib",
    folder: "Kuib",
    asset: "Data/Player Vehicle Data/8 - KwidNormalData.asset",
  },
  {
    id: "bolt-gx",
    folder: "BoltGX",
    asset: "Data/Player Vehicle Data/12 - GolG3NormalData.asset",
  },
  {
    id: "blaster",
    folder: "Blaster",
    asset: "Data/Player Vehicle Data/13 - BlasterNormalData.asset",
  },
  {
    id: "tropeiro",
    folder: "Tropeiro",
    asset: "Data/Player Vehicle Data/18 - BandeirantesNormalData.asset",
  },
  {
    id: "volt-gt",
    folder: "VoltGT",
    asset: "Data/Player Vehicle Data/19 - GolfNormalData.asset",
  },
  {
    id: "polaris",
    folder: "Polaris",
    asset: "Data/Player Vehicle Data/21 - PoloNormalData.asset",
  },
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function guidIndex(root) {
  const index = new Map();
  for (const file of walk(root)) {
    if (!file.endsWith(".meta")) continue;
    const text = fs.readFileSync(file, "utf8");
    const match = text.match(/^guid: ([0-9a-f]{32})/m);
    if (match) index.set(match[1], file.slice(0, -5));
  }
  return index;
}

function parseBlocks(text) {
  return text.split(/^--- !u!/m).slice(1).map((chunk) => {
    const header = chunk.match(/^(\d+) &(-?\d+)/);
    return { type: header ? Number(header[1]) : 0, id: header ? header[2] : "", body: chunk };
  });
}

function field(body, name) {
  const match = body.match(new RegExp(`^  ${name}: (.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function unityName(value) {
  return (value || "")
    .replace(/^"|"$/g, "")
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parsePrefab(text) {
  const gameObjects = new Map();
  const transforms = new Map();
  const renderers = [];

  for (const block of parseBlocks(text)) {
    if (block.type === 1) {
      gameObjects.set(block.id, {
        name: unityName(field(block.body, "m_Name")),
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
      const materialsSection = block.body.split("m_Materials:")[1]?.split(/\n  [A-Za-z_]/)[0] || "";
      const materials = [...materialsSection.matchAll(/guid: ([0-9a-f]{32})/g)].map((match) => match[1]);
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
      active: renderer.enabled && isActive(renderer.gameObject) && !/collision/i.test(go?.name || ""),
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
  const keywords = [...material.matchAll(/- (_[A-Z0-9_]+)/g)].map((match) => match[1]);
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
    emissionOn: keywords.includes("_EMISSION") && emission.slice(0, 3).some((value) => value > 0),
    map: textureGuid(material, "_BaseMap") || textureGuid(material, "_MainTex"),
    normalMap: textureGuid(material, "_BumpMap"),
    emissionMap: textureGuid(material, "_EmissionMap"),
  };
}

function decodeLocalized(raw) {
  let text = raw.replace(/\n\s+/g, " ").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }
  return text
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function loadStringTable(file) {
  const text = fs.readFileSync(file, "utf8");
  const table = new Map();
  for (const part of text.split(/\n  - m_Id: /).slice(1)) {
    const id = part.match(/^(\d+)/)?.[1];
    const localized = part.match(/m_Localized: ([\s\S]*?)\n    m_Metadata:/);
    if (id && localized) table.set(id, decodeLocalized(localized[1]));
  }
  return table;
}

function parseInstances(text) {
  return text.split(/^--- !u!1001 /m).slice(1).map((block) => {
    const guid = block.match(/m_SourcePrefab: \{fileID: \d+, guid: ([0-9a-f]{32})/)?.[1];
    if (!guid) return null;
    const num = (prop) => {
      const match = block.match(new RegExp(`propertyPath: ${prop}\\r?\\n\\s+value: ([^\\r\\n]+)`));
      return match ? Number(match[1]) : 0;
    };
    const has = (prop) => new RegExp(`propertyPath: ${prop}\\r?\\n`).test(block);
    return {
      guid,
      name: block.match(/propertyPath: m_Name\r?\n\s+value: (.+)/)?.[1]?.trim() || "prop",
      position: [num("m_LocalPosition.x"), num("m_LocalPosition.y"), num("m_LocalPosition.z")],
      rotation: [
        num("m_LocalRotation.x"),
        num("m_LocalRotation.y"),
        num("m_LocalRotation.z"),
        has("m_LocalRotation.w") ? num("m_LocalRotation.w") : 1,
      ],
    };
  }).filter(Boolean);
}

function vec(body, key, size) {
  const match = body.match(new RegExp(`${key}:\\s*\\{([^}]+)\\}`));
  if (!match) return null;
  const values = [...match[1].matchAll(/-?[\d.eE+-]+/g)].map((item) => Number(item[0]));
  return values.length >= size ? values.slice(0, size) : null;
}

function shopLayout(text) {
  const gameObjects = new Map();
  const transforms = new Map();
  const meshObjects = [];
  for (const block of parseBlocks(text)) {
    if (block.type === 1) {
      gameObjects.set(block.id, unityName(field(block.body, "m_Name")));
    } else if (block.type === 4) {
      const go = block.body.match(/m_GameObject: \{fileID: (-?\d+)\}/);
      const father = block.body.match(/m_Father: \{fileID: (-?\d+)\}/);
      const children = block.body.split("m_Children:")[1]?.split("m_Father:")[0] || "";
      transforms.set(block.id, {
        go: go?.[1] || null,
        father: father?.[1] || "0",
        children: (children.match(/fileID:/g) || []).length,
        position: vec(block.body, "m_LocalPosition", 3) || [0, 0, 0],
        rotation: vec(block.body, "m_LocalRotation", 4) || [0, 0, 0, 1],
      });
    } else if (block.type === 33) {
      const go = block.body.match(/m_GameObject: \{fileID: (-?\d+)\}/);
      if (go) meshObjects.push(go[1]);
    }
  }

  const root = [...transforms.entries()].find(([, transform]) => transform.father === "0");
  let frame = null;
  if (root) {
    for (const [id, transform] of transforms) {
      if (transform.father !== root[0]) continue;
      if (!frame || transform.children > frame.children) frame = { id, ...transform };
    }
  }
  const transformByObject = new Map();
  for (const [id, transform] of transforms) {
    if (transform.go) transformByObject.set(transform.go, { id, ...transform });
  }
  const placements = [];
  for (const go of meshObjects) {
    const transform = transformByObject.get(go);
    if (!transform || !root || transform.father !== root[0] || transform.id === frame?.id) continue;
    const name = gameObjects.get(go);
    if (!name || !/exhaust/i.test(name)) continue;
    placements.push({
      name,
      position: transform.position,
      rotation: transform.rotation,
    });
  }
  return {
    frame: frame && frame.children > 3 ? frame.rotation : [0, 0, 0, 1],
    placements,
  };
}

function parseVehicle(file) {
  const text = fs.readFileSync(file, "utf8");
  const value = (key) => text.match(new RegExp(`<${key}>k__BackingField: (.+)`))?.[1]?.trim() ?? "";
  const shop = text.match(/<CarShopPrefab>[\s\S]*?guid: ([0-9a-f]{32})/);
  const keyId = text.match(/<CustomText>[\s\S]*?m_KeyId: (\d+)/);
  const colorsBlock = text.match(/<DefaultColors>k__BackingField:([\s\S]*?)\n  <DefaultPaintPreset>/);
  const colors = [...(colorsBlock?.[1] || "").matchAll(/\{r: ([^,]+), g: ([^,]+), b: ([^,]+)/g)]
    .map((match) => match.slice(1, 4).map(Number));
  return {
    name: value("Name"),
    manufacturer: value("Manufacturer"),
    year: Number(value("VehicleYear")),
    price: Number(value("Price")),
    shopGuid: shop?.[1],
    textId: keyId?.[1],
    colors,
  };
}

const assets = guidIndex(PROJECT);
const portuguese = new Map([
  ...loadStringTable(path.join(UNITY, "Assets/Localization/String Tables/Names_Cars_Trailers_City_pt-BR.asset")),
  ...loadStringTable(path.join(UNITY, "Assets/Localization/String Tables/GenericTextTable_pt-BR.asset")),
]);
const english = new Map([
  ...loadStringTable(path.join(UNITY, "Assets/Localization/String Tables/Names_Cars_Trailers_City_en.asset")),
  ...loadStringTable(path.join(UNITY, "Assets/Localization/String Tables/GenericTextTable_en.asset")),
]);

const summaries = [];

for (const car of CARS) {
  const vehicle = parseVehicle(path.join(PROJECT, car.asset));
  const prefabPath = assets.get(vehicle.shopGuid);
  if (!prefabPath) throw new Error(`missing shop prefab for ${car.id}`);
  const prefab = fs.readFileSync(prefabPath, "utf8");
  const parts = parsePrefab(prefab);
  const bodyGuid = prefab.match(/baseMaterial: \{fileID: \d+, guid: ([0-9a-f]{32})/)?.[1];
  const modelGuids = [...new Set([...prefab.matchAll(/m_Mesh: \{fileID: -?\d+, guid: ([0-9a-f]{32})/g)].map((match) => match[1]))];
  const out = path.join(SITE, car.folder);
  fs.mkdirSync(path.join(out, "textures"), { recursive: true });

  const modelFiles = [];
  modelGuids.forEach((guid, index) => {
    const source = assets.get(guid);
    if (!source) {
      console.warn(car.id, "missing model", guid);
      return;
    }
    const filename = index === 0 ? `${car.folder}.dae` : `${car.folder}-${index + 1}.dae`;
    fs.copyFileSync(source, path.join(out, filename));
    modelFiles.push(filename);
  });

  const instances = parseInstances(prefab);
  const propFiles = new Map();
  instances.forEach((instance) => {
    if (propFiles.has(instance.guid)) return;
    const propPath = assets.get(instance.guid);
    if (!propPath) {
      console.warn(car.id, "missing prop", instance.guid);
      return;
    }
    const propPrefab = fs.readFileSync(propPath, "utf8");
    const propParts = parsePrefab(propPrefab);
    parts.push(...propParts);
    const propModelGuids = [...new Set([...propPrefab.matchAll(/m_Mesh: \{fileID: -?\d+, guid: ([0-9a-f]{32})/g)].map((match) => match[1]))];
    const filenames = [];
    propModelGuids.forEach((guid, index) => {
      const source = assets.get(guid);
      if (!source) {
        console.warn(car.id, "missing prop model", guid);
        return;
      }
      const filename = `${car.folder}-prop${propFiles.size + 1}${index ? `-${index + 1}` : ""}.dae`;
      fs.copyFileSync(source, path.join(out, filename));
      filenames.push(filename);
    });
    propFiles.set(instance.guid, { files: filenames, parts: propParts });
  });
  const props = instances.filter((instance) => propFiles.has(instance.guid)).map((instance) => ({
    model: propFiles.get(instance.guid).files[0],
    name: instance.name,
    position: instance.position,
    rotation: instance.rotation,
    facing: "outward",
  }));
  const layout = shopLayout(prefab);

  const copied = new Map();
  function copyTexture(guid) {
    if (!guid) return null;
    if (copied.has(guid)) return copied.get(guid);
    const source = assets.get(guid);
    if (!source) {
      console.warn(car.id, "missing texture", guid);
      copied.set(guid, null);
      return null;
    }
    const filename = path.basename(source).replace(/\s+/g, "_");
    fs.copyFileSync(source, path.join(out, "textures", filename));
    copied.set(guid, `textures/${filename}`);
    return copied.get(guid);
  }

  const materials = {};
  for (const guid of [...new Set(parts.flatMap((part) => part.materials))]) {
    const file = assets.get(guid);
    if (!file || !file.endsWith(".mat")) {
      console.warn(car.id, "missing material", guid);
      continue;
    }
    const material = parseMaterial(file, guid);
    if (guid === bodyGuid) {
      material.color = vehicle.colors[0];
      material.role = "body";
    } else if (/window|vidro|glass|parabrisa/i.test(material.name)) {
      material.role = "glass";
    }
    material.map = copyTexture(material.map);
    material.normalMap = copyTexture(material.normalMap);
    material.emissionMap = copyTexture(material.emissionMap);
    delete material.guid;
    materials[guid] = material;
  }

  const catalog = {
    name: vehicle.name,
    manufacturer: vehicle.manufacturer,
    year: vehicle.year,
    price: vehicle.price,
    description: {
      pt: portuguese.get(vehicle.textId) || "",
      en: english.get(vehicle.textId) || "",
    },
    model: modelFiles[0],
    models: modelFiles,
    frame: layout.frame,
    props,
    placements: layout.placements,
    bodyColor: vehicle.colors[0],
    bodyColors: vehicle.colors,
    materials,
    parts,
  };
  fs.writeFileSync(path.join(out, `${car.id}.json`), JSON.stringify(catalog, null, 2));
  summaries.push({
    id: car.id,
    name: `${vehicle.manufacturer} ${vehicle.name} ${vehicle.year}`,
    price: vehicle.price,
    description: catalog.description.pt,
    models: modelFiles.map((file) => ({ file, bytes: fs.statSync(path.join(out, file)).size })),
    parts: parts.length,
    active: parts.filter((part) => part.active).length,
    body: Object.values(materials).find((material) => material.role === "body")?.name || null,
    glass: Object.values(materials).filter((material) => material.role === "glass").map((material) => material.name),
    missingTextures: [...copied.entries()].filter(([, value]) => !value).map(([guid]) => guid),
  });
}

const listPath = path.join(SITE, "cars.json");
const existing = JSON.parse(fs.readFileSync(listPath, "utf8"));
const byId = new Map(existing.cars.map((entry) => [entry.id, entry]));
for (const car of CARS) {
  byId.set(car.id, { id: car.id, catalog: `models/Cars/${car.folder}/${car.id}.json` });
}
const order = ["sarreiro", "duol", "getta", "kuib", "voll-rtx", "del-valle", "bolt-gx", "blaster", "tropeiro", "volt-gt", "polaris"];
const cars = order.filter((id) => byId.has(id)).map((id) => byId.get(id));
fs.writeFileSync(listPath, JSON.stringify({ cars }, null, 2) + "\n");
console.log(JSON.stringify(summaries, null, 2));
