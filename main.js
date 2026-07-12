import * as THREE from './vendor/three/three.module.min.js';
import { getContentForImage, loadContent } from './content-store.js';

// Najważniejsze parametry — zmień je tutaj, aby dopasować wygląd i zachowanie.
const SPHERE_RADIUS = 4.15;
const IMAGE_SIZE = 0.72;
const IMAGE_COUNT = Infinity; // np. 100 ogranicza liczbę obrazów; Infinity pokazuje wszystkie
const AUTO_ROTATE_SPEED = 0.00045;
const AUTO_ROTATE_DELAY = 3000;
const BACKGROUND_COLOR = 0x07110f;
const MIN_CAMERA_DISTANCE = 7;
const MAX_CAMERA_DISTANCE = 15;
const LOAD_CONCURRENCY = 10;
const TEXTURE_MAX_SIZE = 256;
const INITIAL_REVEAL_RATIO = 0.2;

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const progressBar = document.querySelector('#progress-bar');
const progressLabel = document.querySelector('#progress-label');
const countLabel = document.querySelector('#image-count');
const resetButton = document.querySelector('#reset-view');
const hint = document.querySelector('#interaction-hint');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxCaption = document.querySelector('#lightbox-caption');
const factCategory = document.querySelector('#fact-category');
const factTitle = document.querySelector('#fact-title');
const factSummary = document.querySelector('#fact-summary');
const factText = document.querySelector('#fact-text');

let scene;
let camera;
let renderer;
let sphereGroup;
let imageMeshes = [];
let hoveredMesh = null;
let pointerDown = false;
let pointerMoved = false;
let lastPointer = { x: 0, y: 0 };
let downPointer = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let lastInteraction = performance.now();
let pinchDistance = 0;
let closeCardTimer = null;
let previouslyFocusedElement = null;

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2(2, 2);
const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let lastFrameTime = performance.now();

init().catch((error) => {
  console.error(error);
  countLabel.textContent = 'Nie udało się wczytać kolekcji';
  progressLabel.textContent = 'Błąd';
});

async function init() {
  setupScene();
  bindEvents();

  const [response] = await Promise.all([fetch('manifest.json'), loadContent()]);
  if (!response.ok) throw new Error('Nie znaleziono manifest.json. Uruchom: node generate-manifest.js');

  const manifest = await response.json();
  const paths = manifest.images.slice(0, IMAGE_COUNT);
  countLabel.textContent = `${paths.length} obrazów w kolekcji`;

  createImagePlaces(paths);
  animate();
  await loadTextures(paths);
  loading.classList.add('is-done');
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);
  scene.fog = new THREE.FogExp2(BACKGROUND_COLOR, 0.047);

  camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, getInitialCameraDistance());

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.4 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  sphereGroup = new THREE.Group();
  sphereGroup.position.x = innerWidth > 760 ? 1.75 : 0;
  sphereGroup.rotation.set(-0.08, -0.35, 0.04);
  scene.add(sphereGroup);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(SPHERE_RADIUS * 0.79, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x163a2b, transparent: true, opacity: 0.075, side: THREE.BackSide })
  );
  sphereGroup.add(glow);
}

function getInitialCameraDistance() {
  return innerWidth < 760 ? 11.8 : 10.8;
}

// Złota spirala zapewnia równomierne rozłożenie punktów bez zagęszczenia na biegunach.
function fibonacciPoint(index, total, radius) {
  const y = 1 - (index / Math.max(total - 1, 1)) * 2;
  const radial = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  return new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial).multiplyScalar(radius);
}

function createImagePlaces(paths) {
  const geometry = new THREE.PlaneGeometry(IMAGE_SIZE, IMAGE_SIZE * 0.72);
  const placeholder = new THREE.MeshBasicMaterial({ color: 0x20372e, transparent: true, opacity: 0.36, side: THREE.DoubleSide });

  imageMeshes = paths.map((path, index) => {
    const mesh = new THREE.Mesh(geometry, placeholder.clone());
    const position = fibonacciPoint(index, paths.length, SPHERE_RADIUS);
    mesh.position.copy(position);
    mesh.lookAt(position.clone().multiplyScalar(2));
    mesh.userData = { path, index, loaded: false };
    sphereGroup.add(mesh);
    return mesh;
  });
  placeholder.dispose();
}

async function loadTextures(paths) {
  const textureLoader = new THREE.TextureLoader();
  let loaded = 0;
  let cursor = 0;
  const revealAfter = Math.max(1, Math.ceil(paths.length * INITIAL_REVEAL_RATIO));

  const worker = async () => {
    while (cursor < paths.length) {
      const index = cursor++;
      try {
        const sourceTexture = await textureLoader.loadAsync(paths[index]);
        const texture = createSphereTexture(sourceTexture);
        const mesh = imageMeshes[index];
        mesh.material.dispose();
        mesh.material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
        mesh.userData.loaded = true;
      } catch (error) {
        console.warn(`Nie udało się wczytać: ${paths[index]}`, error);
      }

      loaded += 1;
      const percent = Math.round((loaded / paths.length) * 100);
      progressBar.style.width = `${percent}%`;
      progressLabel.textContent = `${percent}%`;
      if (loaded >= revealAfter) loading.classList.add('is-done');
    }
  };

  await Promise.all(Array.from({ length: Math.min(LOAD_CONCURRENCY, paths.length) }, worker));
}

function createSphereTexture(sourceTexture) {
  const image = sourceTexture.image;
  const scale = Math.min(1, TEXTURE_MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  let texture = sourceTexture;

  if (scale < 1) {
    const canvasTexture = document.createElement('canvas');
    canvasTexture.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvasTexture.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvasTexture.getContext('2d', { alpha: false });
    if (context) {
      context.drawImage(image, 0, 0, canvasTexture.width, canvasTexture.height);
      texture = new THREE.CanvasTexture(canvasTexture);
      sourceTexture.dispose();
    }
  }

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function bindEvents() {
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  resetButton.addEventListener('click', resetView);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox || event.target.closest('.lightbox-close')) closeLightbox();
  });
}

function markInteraction() {
  lastInteraction = performance.now();
  hint.style.opacity = '0';
}

function onPointerDown(event) {
  if (lightbox.hidden === false) return;
  pointerDown = true;
  pointerMoved = false;
  lastPointer = { x: event.clientX, y: event.clientY };
  downPointer = { ...lastPointer };
  velocity = { x: 0, y: 0 };
  canvas.classList.add('is-dragging');
  canvas.setPointerCapture?.(event.pointerId);
  markInteraction();
}

function onPointerMove(event) {
  updatePointerNdc(event.clientX, event.clientY);
  if (!pointerDown || !sphereGroup) return;

  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;
  if (Math.hypot(event.clientX - downPointer.x, event.clientY - downPointer.y) > 5) pointerMoved = true;

  const speed = 0.0052;
  sphereGroup.rotation.y += dx * speed;
  sphereGroup.rotation.x += dy * speed;
  sphereGroup.rotation.x = THREE.MathUtils.clamp(sphereGroup.rotation.x, -1.25, 1.25);
  velocity = { x: dy * speed, y: dx * speed };
  lastPointer = { x: event.clientX, y: event.clientY };
  markInteraction();
}

function onPointerUp(event) {
  if (!pointerDown) return;
  pointerDown = false;
  canvas.classList.remove('is-dragging');
  if (!pointerMoved) {
    if (hoveredMesh?.userData.loaded) onImageClick(hoveredMesh.userData);
    else pickImage(event.clientX, event.clientY);
  }
}

function updatePointerNdc(x, y) {
  pointerNdc.x = (x / innerWidth) * 2 - 1;
  pointerNdc.y = -(y / innerHeight) * 2 + 1;
}

function onWheel(event) {
  event.preventDefault();
  camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.008, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  markInteraction();
}

function onTouchStart(event) {
  if (event.touches.length === 2) {
    pinchDistance = touchDistance(event.touches);
    markInteraction();
  }
}

function onTouchMove(event) {
  if (event.touches.length !== 2) return;
  event.preventDefault();
  const nextDistance = touchDistance(event.touches);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z + (pinchDistance - nextDistance) * 0.018, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  pinchDistance = nextDistance;
  markInteraction();
}

function touchDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function raycastAt(x, y) {
  updatePointerNdc(x, y);
  raycaster.setFromCamera(pointerNdc, camera);
  return raycaster.intersectObjects(imageMeshes, false)[0]?.object ?? null;
}

function pickImage(x, y) {
  const mesh = raycastAt(x, y);
  if (mesh?.userData.loaded) onImageClick(mesh.userData);
}

// Punkt rozszerzenia: tutaj można podmienić lightbox na link lub własną akcję.
function onImageClick(imageData) {
  const fact = getContentForImage(imageData.path);
  const fallbackTitle = humanizeFilename(imageData.path);
  lightboxImage.src = imageData.path;
  lightboxImage.alt = fact?.title || fallbackTitle;
  lightboxCaption.textContent = imageData.path.split('/').pop();
  factCategory.textContent = fact?.category || 'Sfera wiedzy';
  factTitle.textContent = fact?.title || fallbackTitle;
  factSummary.textContent = fact?.summary || 'Ten obraz nie ma jeszcze przypisanej ciekawostki.';
  factText.textContent = fact?.text || 'Zajrzyj tu ponownie — kolekcja jest stale rozwijana o nowe historie i odkrycia.';
  previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  clearTimeout(closeCardTimer);
  lightbox.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => lightbox.classList.add('is-open')));
  lightbox.querySelector('.lightbox-close').focus({ preventScroll: true });
}

function humanizeFilename(path) {
  const filename = decodeURIComponent(path.split('/').pop().replace(/\.webp$/i, ''));
  return filename.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function closeLightbox() {
  if (lightbox.hidden) return;
  lightbox.classList.remove('is-open');
  clearTimeout(closeCardTimer);
  closeCardTimer = setTimeout(() => {
    lightbox.hidden = true;
    lightboxImage.removeAttribute('src');
    previouslyFocusedElement?.focus({ preventScroll: true });
    previouslyFocusedElement = null;
  }, 400);
  markInteraction();
}

function onKeyDown(event) {
  if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
}

function resetView() {
  sphereGroup.rotation.set(-0.08, -0.35, 0.04);
  camera.position.z = getInitialCameraDistance();
  velocity = { x: 0, y: 0 };
  markInteraction();
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.4 : 1.8));
  sphereGroup.position.x = innerWidth > 760 ? 1.75 : 0;
}

function updateHover() {
  if (pointerDown || !lightbox.hidden) return;
  raycaster.setFromCamera(pointerNdc, camera);
  const actual = raycaster.intersectObjects(imageMeshes, false)[0]?.object ?? null;

  if (actual !== hoveredMesh) {
    if (hoveredMesh) hoveredMesh.userData.hovered = false;
    hoveredMesh = actual?.userData.loaded ? actual : null;
    if (hoveredMesh) hoveredMesh.userData.hovered = true;
    canvas.classList.toggle('is-hovering', Boolean(hoveredMesh));
  }
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;

  if (!pointerDown && lightbox.hidden) {
    sphereGroup.rotation.x += velocity.x;
    sphereGroup.rotation.y += velocity.y;
    velocity.x *= Math.pow(0.91, delta * 60);
    velocity.y *= Math.pow(0.91, delta * 60);

    if (performance.now() - lastInteraction > AUTO_ROTATE_DELAY && !reducedMotionQuery.matches) {
      sphereGroup.rotation.y += AUTO_ROTATE_SPEED * delta * 60;
    }
  }

  updateHover();
  for (const mesh of imageMeshes) {
    const target = mesh.userData.hovered ? 1.3 : 1;
    mesh.scale.setScalar(THREE.MathUtils.lerp(mesh.scale.x, target, 0.16));
    if (mesh.userData.loaded) mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, mesh.userData.hovered ? 1 : 0.9, 0.12);
  }

  renderer.render(scene, camera);
}
