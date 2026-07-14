import * as THREE from './vendor/three/three.module.min.js';
import { getContentForImage, loadContent } from './content-store.js';
import {
  canCloseFactWithHistoryBack,
  clearFactFromUrl,
  getFactIdForImage,
  hasFactParameterInUrl,
  readFactIdFromUrl,
  writeFactToUrl
} from './fact-links.js';
import { createSphereFocusController } from './sphere-focus.js';
import { createImageTransitionController } from './image-transition.js';

// Najważniejsze parametry — zmień je tutaj, aby dopasować wygląd i zachowanie.
const SPHERE_RADIUS = 4.15;
const IMAGE_SIZE = 0.72;
const IMAGE_HEIGHT_RATIO = 0.72;
const IMAGE_ASPECT_RATIO = 1 / IMAGE_HEIGHT_RATIO;
const IMAGE_COUNT = Infinity; // np. 100 ogranicza liczbę obrazów; Infinity pokazuje wszystkie
const AUTO_ROTATE_SPEED = 0.00045;
const AUTO_ROTATE_DELAY = 3000;
const BACKGROUND_COLOR = 0x07110f;
const MIN_CAMERA_DISTANCE = 7;
const MAX_CAMERA_DISTANCE = 15;
const LOAD_CONCURRENCY = 10;
const TEXTURE_MAX_SIZE = 256;
const INITIAL_REVEAL_RATIO = 0.2;
const POINTER_MOVE_THRESHOLD = { mouse: 5, pen: 8, touch: 12 };
const INITIAL_SPHERE_ROTATION = { x: -0.08, y: -0.35, z: 0.04 };

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const progressBar = document.querySelector('#progress-bar');
const progressLabel = document.querySelector('#progress-label');
const countLabel = document.querySelector('#image-count');
const resetButton = document.querySelector('#reset-view');
const randomButton = document.querySelector('#random-fact');
const hint = document.querySelector('#interaction-hint');
const lightbox = document.querySelector('#lightbox');
const factMedia = document.querySelector('.fact-media');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxCaption = document.querySelector('#lightbox-caption');
const factCategory = document.querySelector('#fact-category');
const factTitle = document.querySelector('#fact-title');
const factSummary = document.querySelector('#fact-summary');
const factText = document.querySelector('#fact-text');
const copyLinkButton = document.querySelector('#copy-fact-link');

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
let activePointerType = 'mouse';
let multiTouchGesture = false;
let closeCardTimer = null;
let previouslyFocusedElement = null;
let focusController = null;
let imageTransitionController = null;
let spherePitch = INITIAL_SPHERE_ROTATION.x;
let activeFactMesh = null;
let cardTransitionId = 0;
let cardClosing = false;
let activeFactId = '';
let lastRandomFactId = '';
let pendingFactId = '';
let copyFeedbackTimer = null;

const defaultDocumentTitle = document.title;

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2(2, 2);
const worldXAxis = new THREE.Vector3(1, 0, 0);
const worldYAxis = new THREE.Vector3(0, 1, 0);
const pitchQuaternion = new THREE.Quaternion();
const yawQuaternion = new THREE.Quaternion();
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
  countLabel.textContent = `${paths.length} ciekawostek`;

  createImagePlaces(paths);
  focusController = createSphereFocusController({
    group: sphereGroup,
    camera,
    meshes: imageMeshes,
    reducedMotion: reducedMotionQuery
  });
  imageTransitionController = createImageTransitionController({
    camera,
    reducedMotion: reducedMotionQuery
  });
  animate();
  await loadTextures(paths);
  loading.classList.add('is-done');
  randomButton.disabled = false;
  openInitialFactFromUrl();
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
  sphereGroup.rotation.set(INITIAL_SPHERE_ROTATION.x, INITIAL_SPHERE_ROTATION.y, INITIAL_SPHERE_ROTATION.z);
  spherePitch = INITIAL_SPHERE_ROTATION.x;
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
  const y = 1 - (2 * (index + 0.5)) / Math.max(total, 1);
  const radial = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  return new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial).multiplyScalar(radius);
}

function createImagePlaces(paths) {
  const geometry = new THREE.PlaneGeometry(IMAGE_SIZE, IMAGE_SIZE * IMAGE_HEIGHT_RATIO);
  const placeholder = new THREE.MeshBasicMaterial({ color: 0x20372e, transparent: true, opacity: 0.36, side: THREE.DoubleSide });

  imageMeshes = paths.map((path, index) => {
    const mesh = new THREE.Mesh(geometry, placeholder.clone());
    const position = fibonacciPoint(index, paths.length, SPHERE_RADIUS);
    mesh.position.copy(position);
    mesh.lookAt(position.clone().multiplyScalar(2));
    mesh.userData = {
      path,
      index,
      loaded: false,
      category: getContentForImage(path)?.category || ''
    };
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
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const scale = Math.min(1, TEXTURE_MAX_SIZE / Math.max(sourceWidth, sourceHeight));
  let texture = sourceTexture;

  if (scale < 1) {
    const canvasTexture = document.createElement('canvas');
    canvasTexture.width = Math.max(1, Math.round(sourceWidth * scale));
    canvasTexture.height = Math.max(1, Math.round(sourceHeight * scale));
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
  applyTextureCover(texture, sourceAspectRatio, IMAGE_ASPECT_RATIO);
  texture.needsUpdate = true;
  return texture;
}

function applyTextureCover(texture, sourceAspectRatio, targetAspectRatio) {
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);

  if (sourceAspectRatio > targetAspectRatio) {
    texture.repeat.x = targetAspectRatio / sourceAspectRatio;
    texture.offset.x = (1 - texture.repeat.x) / 2;
    return;
  }

  texture.repeat.y = sourceAspectRatio / targetAspectRatio;
  texture.offset.y = (1 - texture.repeat.y) / 2;
}

function bindEvents() {
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('popstate', onHistoryChange);
  resetButton.addEventListener('click', resetView);
  randomButton.addEventListener('click', openRandomFact);
  copyLinkButton.addEventListener('click', copyCurrentFactLink);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox || event.target.closest('.lightbox-close')) requestCloseLightbox();
  });
}

function markInteraction() {
  lastInteraction = performance.now();
  hint.style.opacity = '0';
}

function onPointerDown(event) {
  if (lightbox.hidden === false) return;
  focusController?.interruptRestore();
  if (!focusController?.isIdle()) return;
  pointerDown = true;
  pointerMoved = false;
  activePointerType = event.pointerType || 'mouse';
  if (activePointerType !== 'mouse') clearHoveredMesh();
  lastPointer = { x: event.clientX, y: event.clientY };
  downPointer = { ...lastPointer };
  velocity = { x: 0, y: 0 };
  canvas.classList.add('is-dragging');
  canvas.setPointerCapture?.(event.pointerId);
  markInteraction();
}

function onPointerMove(event) {
  updatePointerNdc(event.clientX, event.clientY);
  if (!pointerDown || !sphereGroup || multiTouchGesture) return;

  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;
  const moveThreshold = POINTER_MOVE_THRESHOLD[activePointerType] ?? POINTER_MOVE_THRESHOLD.mouse;
  if (!pointerMoved) {
    const distanceFromStart = Math.hypot(event.clientX - downPointer.x, event.clientY - downPointer.y);
    if (distanceFromStart <= moveThreshold) {
      lastPointer = { x: event.clientX, y: event.clientY };
      return;
    }
    pointerMoved = true;
  }

  const speed = 0.0052;
  const pitchDelta = rotateSphere(dy * speed, dx * speed);
  velocity = { x: pitchDelta, y: dx * speed };
  lastPointer = { x: event.clientX, y: event.clientY };
  markInteraction();
}

function onPointerUp(event) {
  if (!pointerDown) return;
  pointerDown = false;
  canvas.classList.remove('is-dragging');
  if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (!pointerMoved && !multiTouchGesture) pickImage(event.clientX, event.clientY);
}

function onPointerCancel(event) {
  pointerDown = false;
  pointerMoved = true;
  canvas.classList.remove('is-dragging');
  if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
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
    multiTouchGesture = true;
    pointerMoved = true;
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

function onTouchEnd(event) {
  if (event.touches.length === 0) multiTouchGesture = false;
}

function touchDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function raycastAt(x, y) {
  updatePointerNdc(x, y);
  sphereGroup.updateWorldMatrix(true, true);
  camera.updateWorldMatrix(true, false);
  raycaster.setFromCamera(pointerNdc, camera);
  const intersections = raycaster.intersectObjects(imageMeshes, false);
  return intersections.find(({ object }) => object.userData.loaded)?.object ?? null;
}

function pickImage(x, y) {
  const mesh = raycastAt(x, y);
  if (mesh) onImageClick(mesh);
}

function clearHoveredMesh() {
  if (hoveredMesh) hoveredMesh.userData.hovered = false;
  hoveredMesh = null;
  canvas.classList.remove('is-hovering');
}

function onImageClick(mesh, { updateUrl = true, canGoBack = true } = {}) {
  const imageData = mesh.userData;
  const fact = getContentForImage(imageData.path);
  const factId = getFactIdForImage(imageData.path);
  velocity = { x: 0, y: 0 };
  clearHoveredMesh();

  const started = focusController.focus(mesh, fact?.category, () => openFactCard(mesh, imageData, fact));
  if (!started) return false;

  previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeFactId = factId;
  lastRandomFactId = factId;
  if (updateUrl) writeFactToUrl(factId, { canGoBack });
  return true;
}

async function openFactCard(mesh, imageData, fact) {
  const transitionId = ++cardTransitionId;
  cardClosing = false;
  const fallbackTitle = humanizeFilename(imageData.path);
  lightboxImage.src = imageData.path;
  lightboxImage.alt = fact?.title || fallbackTitle;
  lightboxCaption.textContent = imageData.path.split('/').pop();
  factCategory.textContent = fact?.category || 'Sfera wiedzy';
  factTitle.textContent = fact?.title || fallbackTitle;
  factSummary.textContent = fact?.summary || 'Ten obraz nie ma jeszcze przypisanej ciekawostki.';
  factText.textContent = fact?.text || 'Zajrzyj tu ponownie — kolekcja jest stale rozwijana o nowe historie i odkrycia.';
  document.title = `${fact?.title || fallbackTitle} | Sfera wiedzy`;
  resetCopyLinkButton();
  clearTimeout(closeCardTimer);
  lightbox.hidden = false;
  activeFactMesh = mesh;
  lightbox.classList.add('is-shared-opening');

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (transitionId !== cardTransitionId || lightbox.hidden) return;

  const sourceRect = imageTransitionController?.getMeshScreenRect(mesh);
  const canAnimate = Boolean(sourceRect && imageTransitionController);
  if (canAnimate) mesh.userData.transitionHidden = true;
  lightbox.classList.add('is-open');

  if (canAnimate) {
    const animated = await imageTransitionController.open({
      src: imageData.path,
      alt: lightboxImage.alt,
      from: () => sourceRect,
      to: () => factMedia.getBoundingClientRect()
    });
    if (!animated && transitionId === cardTransitionId) mesh.userData.transitionHidden = false;
  }

  if (transitionId !== cardTransitionId || lightbox.hidden) return;
  lightbox.classList.remove('is-shared-opening');
  lightbox.querySelector('.lightbox-close').focus({ preventScroll: true });
}

function humanizeFilename(path) {
  const filename = decodeURIComponent(path.split('/').pop().replace(/\.webp$/i, ''));
  return filename.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function requestCloseLightbox() {
  if (canCloseFactWithHistoryBack(activeFactId)) {
    window.history.back();
    return;
  }

  clearFactFromUrl({ replace: true });
  closeLightbox();
}

function closeLightbox() {
  if (lightbox.hidden) {
    if (focusController?.isActive()) focusController.restore();
    activeFactId = '';
    document.title = defaultDocumentTitle;
    return;
  }
  if (cardClosing) return;

  cardClosing = true;
  const transitionId = ++cardTransitionId;
  const closingMesh = activeFactMesh;
  const imagePath = lightboxImage.currentSrc || lightboxImage.src;
  const imageAlt = lightboxImage.alt;
  const canAnimate = Boolean(
    closingMesh
    && imagePath
    && imageTransitionController?.getMeshScreenRect(closingMesh)
  );

  imageTransitionController?.cancel();
  lightbox.classList.remove('is-shared-opening');
  lightbox.classList.toggle('is-shared-closing', canAnimate);
  lightbox.classList.remove('is-open');
  focusController?.restore();
  activeFactId = '';
  document.title = defaultDocumentTitle;
  clearTimeout(copyFeedbackTimer);
  clearTimeout(closeCardTimer);
  const closeAnimation = canAnimate
    ? imageTransitionController.close({
        src: imagePath,
        alt: imageAlt,
        from: () => factMedia.getBoundingClientRect(),
        to: () => imageTransitionController.getMeshScreenRect(closingMesh),
        onProgress: (progress) => {
          if (progress >= 0.62) closingMesh.userData.transitionHidden = false;
        }
      })
    : new Promise((resolve) => {
        closeCardTimer = setTimeout(resolve, 400);
      });

  closeAnimation.then(() => {
    if (transitionId !== cardTransitionId) return;
    if (closingMesh) closingMesh.userData.transitionHidden = false;
    lightbox.classList.remove('is-shared-closing');
    lightbox.hidden = true;
    lightboxImage.removeAttribute('src');
    activeFactMesh = null;
    cardClosing = false;
    previouslyFocusedElement?.focus({ preventScroll: true });
    previouslyFocusedElement = null;
    if (pendingFactId) {
      const nextFactId = pendingFactId;
      pendingFactId = '';
      focusController?.interruptRestore();
      openFactById(nextFactId, { updateUrl: false });
    }
  });
  markInteraction();
}

function onKeyDown(event) {
  if (event.key !== 'Escape') return;
  if (!lightbox.hidden) requestCloseLightbox();
  else if (focusController?.isActive()) {
    clearFactFromUrl({ replace: true });
    closeLightbox();
  }
}

function resetView() {
  focusController?.reset();
  clearHoveredMesh();
  if (activeFactId || hasFactParameterInUrl()) clearFactFromUrl({ replace: true });
  activeFactId = '';
  document.title = defaultDocumentTitle;
  sphereGroup.rotation.set(INITIAL_SPHERE_ROTATION.x, INITIAL_SPHERE_ROTATION.y, INITIAL_SPHERE_ROTATION.z);
  spherePitch = INITIAL_SPHERE_ROTATION.x;
  camera.position.z = getInitialCameraDistance();
  velocity = { x: 0, y: 0 };
  markInteraction();
}

function openInitialFactFromUrl() {
  const factId = readFactIdFromUrl();
  if (!factId) {
    if (hasFactParameterInUrl()) clearFactFromUrl({ replace: true });
    return;
  }

  writeFactToUrl(factId, { replace: true, canGoBack: false });
  if (!openFactById(factId, { updateUrl: false })) clearFactFromUrl({ replace: true });
}

function openFactById(factId, options = {}) {
  const mesh = imageMeshes.find((candidate) => getFactIdForImage(candidate.userData.path) === factId);
  if (!mesh?.userData.loaded) return false;

  focusController?.interruptRestore();
  return onImageClick(mesh, options);
}

function openRandomFact() {
  if (!lightbox.hidden) return;
  focusController?.interruptRestore();
  if (!focusController?.isIdle()) return;

  const available = imageMeshes.filter((mesh) => mesh.userData.loaded && getContentForImage(mesh.userData.path));
  const candidates = available.filter((mesh) => getFactIdForImage(mesh.userData.path) !== lastRandomFactId);
  const pool = candidates.length ? candidates : available;
  if (!pool.length) return;

  const mesh = pool[Math.floor(Math.random() * pool.length)];
  onImageClick(mesh);
}

function onHistoryChange() {
  const factId = readFactIdFromUrl();

  if (!factId) {
    if (hasFactParameterInUrl()) clearFactFromUrl({ replace: true });
    pendingFactId = '';
    closeLightbox();
    return;
  }

  if (factId === activeFactId) return;
  if (!lightbox.hidden) {
    pendingFactId = factId;
    closeLightbox();
    return;
  }

  if (!openFactById(factId, { updateUrl: false })) clearFactFromUrl({ replace: true });
}

async function copyCurrentFactLink() {
  if (!activeFactId) return;

  clearTimeout(copyFeedbackTimer);
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(window.location.href);
    copyLinkButton.textContent = 'Skopiowano';
  } catch {
    copyLinkButton.textContent = 'Link jest w pasku adresu';
  }

  copyFeedbackTimer = setTimeout(resetCopyLinkButton, 2200);
}

function resetCopyLinkButton() {
  copyLinkButton.textContent = 'Kopiuj link';
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.4 : 1.8));
  sphereGroup.position.x = innerWidth > 760 ? 1.75 : 0;
}

function updateHover() {
  if (pointerDown || !lightbox.hidden || !focusController?.isIdle()) return;
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

  if (!pointerDown && lightbox.hidden && focusController?.isIdle()) {
    velocity.x = rotateSphere(velocity.x, velocity.y);
    velocity.x *= Math.pow(0.91, delta * 60);
    velocity.y *= Math.pow(0.91, delta * 60);

    if (performance.now() - lastInteraction > AUTO_ROTATE_DELAY && !reducedMotionQuery.matches) {
      rotateSphere(0, AUTO_ROTATE_SPEED * delta * 60);
    }
  }

  updateHover();
  focusController?.update(now, hoveredMesh);

  renderer.render(scene, camera);
}

function rotateSphere(pitchDelta, yawDelta) {
  const nextPitch = THREE.MathUtils.clamp(spherePitch + pitchDelta, -1.25, 1.25);
  const appliedPitch = nextPitch - spherePitch;

  if (yawDelta) {
    yawQuaternion.setFromAxisAngle(worldYAxis, yawDelta);
    sphereGroup.quaternion.premultiply(yawQuaternion);
  }

  if (appliedPitch) {
    pitchQuaternion.setFromAxisAngle(worldXAxis, appliedPitch);
    sphereGroup.quaternion.premultiply(pitchQuaternion);
  }

  spherePitch = nextPitch;
  return appliedPitch;
}
