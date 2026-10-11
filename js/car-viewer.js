import * as THREE from "three";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const CARS_URL = "models/Cars/cars.json";

const container = document.getElementById("car-stage");
const statusEl = document.getElementById("car-stage-status");
const infoEl = document.getElementById("car-info");
const titleEl = document.getElementById("car-title");
const priceEl = document.getElementById("car-price");
const descriptionEl = document.getElementById("car-description");
const listEl = document.getElementById("car-list");
const prevBtn = document.getElementById("car-prev");
const nextBtn = document.getElementById("car-next");

if (container) {
  initViewer(container, statusEl);
}

function initViewer(container, statusEl) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x212121);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
  camera.position.set(4.2, 1.8, 4.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.7;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x1a1a1a, 0.22));

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(6, 8, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xc9d7ff, 0.45);
  fill.position.set(-5, 3, -3);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.includes(":/") || url.includes("Game Project") || url.includes("Game%20Project")) {
      return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    }
    return url;
  });

  const textureLoader = new THREE.TextureLoader();
  const colladaLoader = new ColladaLoader(manager);
  const catalogCache = new Map();
  let cars = [];
  let currentIndex = 0;
  let carRoot = null;
  let loadToken = 0;

  prevBtn?.addEventListener("click", () => stepCar(-1));
  nextBtn?.addEventListener("click", () => stepCar(1));
  window.addEventListener("laf:langchange", () => {
    const car = cars[currentIndex];
    if (car) updateCarInfo(car.catalog);
    updateNavLabels();
  });

  loadCarList()
    .then((entries) => {
      cars = entries;
      renderCarList();
      return showCar(0);
    })
    .catch(() => showStatus(
      "Não foi possível abrir a lista de carros.",
      "Could not open the car list."
    ));

  function stepCar(delta) {
    if (cars.length < 2) return;
    const next = (currentIndex + delta + cars.length) % cars.length;
    showCar(next);
  }

  async function loadCarList() {
    const index = await fetch(CARS_URL).then((response) => {
      if (!response.ok) throw new Error("cars");
      return response.json();
    });
    return Promise.all(index.cars.map(async (entry) => ({
      id: entry.id,
      catalogUrl: entry.catalog,
      catalog: await loadCatalog(entry.catalog),
    })));
  }

  function loadCatalog(url) {
    if (!catalogCache.has(url)) {
      catalogCache.set(url, fetch(url).then((response) => {
        if (!response.ok) throw new Error("catalog");
        return response.json();
      }));
    }
    return catalogCache.get(url);
  }

  function renderCarList() {
    if (!listEl) return;
    listEl.replaceChildren();
    cars.forEach((car, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "car-list-item";
      button.setAttribute("role", "option");
      button.textContent = car.catalog.name;
      button.addEventListener("click", () => showCar(index));
      listEl.appendChild(button);
    });
    updateNavLabels();
  }

  async function showCar(index) {
    if (!cars[index]) return;
    if (index === currentIndex && carRoot) return;
    const token = ++loadToken;
    currentIndex = index;
    const car = cars[index];
    updateCarInfo(car.catalog);
    markSelectedCar();
    showStatus(`Carregando o ${car.catalog.name}…`, `Loading the ${car.catalog.name}…`);
    document.getElementById("car-colors")?.setAttribute("hidden", "");

    try {
      const loaded = await loadCarModel(car, colladaLoader, textureLoader);
      if (token !== loadToken) {
        disposeObject(loaded.model);
        return;
      }
      mountCar(loaded.model);
      buildColorPicker(loaded.bodyColors, loaded.bodyMaterials);
      if (statusEl) statusEl.hidden = true;
    } catch {
      if (token !== loadToken) return;
      showStatus(
        `Não foi possível abrir o modelo do ${car.catalog.name}.`,
        `Could not open the ${car.catalog.name} model.`
      );
    }
  }

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  resize();
  new ResizeObserver(resize).observe(container);

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  function mountCar(model) {
    if (carRoot) {
      scene.remove(carRoot);
      disposeObject(carRoot);
    }

    carRoot = new THREE.Group();
    carRoot.add(model);
    scene.add(carRoot);

    const box = new THREE.Box3().setFromObject(carRoot);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    carRoot.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const targetSize = 3.4;
    const scale = targetSize / maxDim;
    carRoot.scale.setScalar(scale);

    ground.position.y = (-size.y * scale) / 2 - 0.01;
    controls.target.set(0, 0, 0);

    const distance = targetSize * 1.35;
    camera.position.set(distance * 0.95, distance * 0.42, distance);
    camera.near = Math.max(distance / 200, 0.01);
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function updateCarInfo(catalog) {
    if (infoEl) infoEl.hidden = false;
    const fullName = `${catalog.manufacturer} ${catalog.name} ${catalog.year}`;
    if (titleEl) titleEl.textContent = fullName;
    if (priceEl) priceEl.textContent = formatPrice(catalog.price, currentLang());
    if (descriptionEl) {
      const lang = currentLang();
      descriptionEl.textContent = catalog.description?.[lang] || catalog.description?.pt || "";
    }
    document.title = `${catalog.name} — Carros — Low and Furious`;
    container.setAttribute("aria-label", fullName);
  }

  function markSelectedCar() {
    listEl?.querySelectorAll(".car-list-item").forEach((item, index) => {
      const selected = index === currentIndex;
      item.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function updateNavLabels() {
    const lang = currentLang();
    const single = cars.length < 2;
    if (prevBtn) {
      prevBtn.disabled = single;
      prevBtn.setAttribute("aria-label", lang === "en" ? "Previous car" : "Carro anterior");
    }
    if (nextBtn) {
      nextBtn.disabled = single;
      nextBtn.setAttribute("aria-label", lang === "en" ? "Next car" : "Próximo carro");
    }
    listEl?.setAttribute("aria-label", lang === "en" ? "Cars" : "Carros");
  }
}

async function loadCarModel(car, colladaLoader, textureLoader) {
  const catalog = car.catalog;
  const root = car.catalogUrl.replace(/[^/]+$/, "");
  const materials = new Map();
  const bodyMaterials = [];
  for (const [id, definition] of Object.entries(catalog.materials)) {
    const material = createMaterial(definition, textureLoader, root);
    materials.set(id, material);
    if (definition.role === "body") bodyMaterials.push(material);
  }

  const collada = await colladaLoader.loadAsync(root + catalog.model);
  applyShopMaterials(collada.scene, catalog.parts, materials);
  return {
    model: collada.scene,
    bodyMaterials,
    bodyColors: catalog.bodyColors || [catalog.bodyColor],
  };
}

function currentLang() {
  return window.getLafLang?.() === "en" ? "en" : "pt";
}

function formatPrice(value, lang) {
  const formatted = new Intl.NumberFormat(lang === "en" ? "en-US" : "pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
  return `R$ ${formatted}`;
}

function showStatus(pt, en) {
  if (!statusEl) return;
  const lang = currentLang();
  statusEl.hidden = false;
  statusEl.innerHTML =
    `<p class="lang-pt${lang === "pt" ? " show" : ""}">${escapeHtml(pt)}</p>` +
    `<p class="lang-en${lang === "en" ? " show" : ""}">${escapeHtml(en)}</p>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function disposeObject(root) {
  const materials = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.forEach((material) => material && materials.add(material));
  });
  for (const material of materials) {
    material.map?.dispose();
    material.normalMap?.dispose();
    material.emissiveMap?.dispose();
    material.dispose();
  }
}

function buildColorPicker(colors, bodyMaterials) {
  const root = document.getElementById("car-colors");
  const list = document.getElementById("car-color-swatches");
  if (!root || !list || !colors?.length || bodyMaterials.length === 0) return;
  list.replaceChildren();

  colors.forEach((rgb, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "car-color-swatch";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", index === 0 ? "true" : "false");
    button.style.setProperty("--swatch", cssColor(rgb));
    button.title = cssColor(rgb);
    button.setAttribute("aria-label", cssColor(rgb));
    button.addEventListener("click", () => {
      applyBodyColor(bodyMaterials, rgb);
      for (const item of list.querySelectorAll(".car-color-swatch")) {
        item.setAttribute("aria-checked", item === button ? "true" : "false");
      }
    });
    list.appendChild(button);
  });

  root.hidden = false;
}

function applyBodyColor(bodyMaterials, rgb) {
  const color = new THREE.Color().fromArray(rgb);
  for (const material of bodyMaterials) {
    material.color.copy(color);
  }
}

function cssColor(rgb) {
  const channels = rgb.slice(0, 3).map((channel) => Math.round(channel * 255));
  return `rgb(${channels.join(", ")})`;
}

function createMaterial(definition, textureLoader, root) {
  const roughness = THREE.MathUtils.clamp(1 - definition.smoothness, 0.04, 1);
  const side = definition.cull === 0
    ? THREE.DoubleSide
    : definition.cull === 1
      ? THREE.BackSide
      : THREE.FrontSide;

  let material;
  if (definition.role === "glass") {
    material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().fromArray(definition.color),
      metalness: definition.metallic,
      roughness,
      transmission: THREE.MathUtils.clamp(1 - definition.opacity, 0, 1),
      thickness: 0.12,
      ior: 1.5,
      transparent: true,
      envMapIntensity: 1.5,
      side,
    });
    material.depthWrite = false;
  } else {
    material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().fromArray(definition.color),
      metalness: definition.metallic,
      roughness,
      side,
      envMapIntensity: 1,
    });

    if (definition.alphaClip) {
      material.alphaTest = definition.cutoff || 0.5;
    } else if (definition.transparent) {
      material.transparent = true;
      material.opacity = definition.opacity;
      material.depthWrite = false;
    }

    if (definition.emissionOn) {
      material.emissive = new THREE.Color().fromArray(definition.emission);
    }
  }

  const map = loadTexture(textureLoader, root, definition.map, true);
  const normalMap = loadTexture(textureLoader, root, definition.normalMap, false);
  if (map) material.map = map;
  if (normalMap) material.normalMap = normalMap;
  if (definition.emissionOn && definition.emissionMap) {
    material.emissiveMap = loadTexture(textureLoader, root, definition.emissionMap, true);
  }
  return material;
}

function loadTexture(textureLoader, root, relativePath, srgb) {
  if (!relativePath) return null;
  const texture = textureLoader.load(root + relativePath);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function applyShopMaterials(root, parts, materials) {
  const byName = new Map(parts.map((part) => [part.name, part]));
  const meshesByPart = new Map();

  root.traverse((object) => {
    if (!object.isMesh) return;
    const part = findPart(object, byName);
    if (!part || !part.active) {
      object.visible = false;
      return;
    }
    if (!meshesByPart.has(part.name)) meshesByPart.set(part.name, []);
    meshesByPart.get(part.name).push(object);
  });

  for (const [name, meshes] of meshesByPart) {
    const part = byName.get(name);
    const assigned = part.materials.map((id) => materials.get(id)).filter(Boolean);
    if (assigned.length === 0) continue;

    if (meshes.length === 1 && Array.isArray(meshes[0].material)) {
      meshes[0].material = meshes[0].material.map((_, index) => assigned[index] || assigned[assigned.length - 1]);
      meshes[0].renderOrder = renderOrderFor(assigned[0]);
    } else {
      meshes.forEach((mesh, index) => {
        const material = assigned[index] || assigned[0];
        mesh.material = material;
        mesh.renderOrder = renderOrderFor(material);
      });
    }
  }

  const hidden = [];
  root.traverse((object) => {
    if (object.isMesh && !object.visible) hidden.push(object);
  });
  hidden.forEach((object) => object.removeFromParent());
}

function findPart(object, byName) {
  let current = object;
  while (current) {
    if (byName.has(current.name)) return byName.get(current.name);
    current = current.parent;
  }
  return null;
}

function renderOrderFor(material) {
  if (!material) return 0;
  if (material.isMeshPhysicalMaterial && material.transmission > 0) return 2;
  if (material.transparent || material.alphaTest > 0) return 1;
  return 0;
}
