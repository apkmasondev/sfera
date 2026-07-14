import * as THREE from './vendor/three/three.module.min.js';
import { easeInOutCubic, MOTION } from './motion.js';

const SOURCE_RADIUS = 4;

const corners = Array.from({ length: 4 }, () => new THREE.Vector3());

function isUsableRect(rect) {
  return rect
    && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
    && rect.width > 1
    && rect.height > 1;
}

function copyRect(rect) {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function applyRect(element, rect, radius) {
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
  element.style.borderRadius = `${radius}px`;
}

function interpolateRect(from, to, progress) {
  return {
    left: THREE.MathUtils.lerp(from.left, to.left, progress),
    top: THREE.MathUtils.lerp(from.top, to.top, progress),
    width: THREE.MathUtils.lerp(from.width, to.width, progress),
    height: THREE.MathUtils.lerp(from.height, to.height, progress)
  };
}

export function createImageTransitionController({ camera, reducedMotion }) {
  let activeAnimation = null;

  function getMeshScreenRect(mesh) {
    if (!mesh?.geometry || !camera) return null;

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) return null;

    mesh.updateWorldMatrix(true, false);
    camera.updateWorldMatrix(true, false);

    corners[0].set(box.min.x, box.min.y, 0);
    corners[1].set(box.max.x, box.min.y, 0);
    corners[2].set(box.max.x, box.max.y, 0);
    corners[3].set(box.min.x, box.max.y, 0);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const corner of corners) {
      corner.applyMatrix4(mesh.matrixWorld).project(camera);
      const x = (corner.x * 0.5 + 0.5) * innerWidth;
      const y = (-corner.y * 0.5 + 0.5) * innerHeight;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    const rect = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
    return isUsableRect(rect) ? rect : null;
  }

  function cancel() {
    if (!activeAnimation) return;
    cancelAnimationFrame(activeAnimation.frameId);
    activeAnimation.element.remove();
    activeAnimation.resolve(false);
    activeAnimation = null;
  }

  function animate({ src, from, to, direction, onHandoff }) {
    cancel();
    if (reducedMotion.matches) return Promise.resolve(false);

    const initialRect = from();
    const initialTarget = to();
    if (!isUsableRect(initialRect) || !isUsableRect(initialTarget)) return Promise.resolve(false);

    const element = document.createElement('img');
    element.className = 'shared-image-transition';
    element.src = src;
    element.alt = '';
    element.setAttribute('aria-hidden', 'true');
    applyRect(element, initialRect, direction === 'opening' ? SOURCE_RADIUS : 0);
    document.body.append(element);

    const duration = direction === 'opening' ? MOTION.imageOpenDuration : MOTION.returnDuration;
    const startedAt = performance.now();

    return new Promise((resolve) => {
      activeAnimation = { element, frameId: 0, resolve };

      const update = (now) => {
        if (!activeAnimation || activeAnimation.element !== element) return;

        const rawProgress = THREE.MathUtils.clamp((now - startedAt) / duration, 0, 1);
        const progress = easeInOutCubic(rawProgress);
        const handoffProgress = direction === 'closing'
          ? easeInOutCubic(THREE.MathUtils.clamp(
              (rawProgress - MOTION.closeBlendStart) / (1 - MOTION.closeBlendStart),
              0,
              1
            ))
          : 0;
        onHandoff?.(handoffProgress);
        const currentTarget = to();
        const targetRect = isUsableRect(currentTarget) ? copyRect(currentTarget) : initialTarget;
        const currentRect = interpolateRect(initialRect, targetRect, progress);
        const radius = THREE.MathUtils.lerp(
          direction === 'opening' ? SOURCE_RADIUS : 0,
          direction === 'opening' ? 0 : SOURCE_RADIUS,
          progress
        );

        applyRect(element, currentRect, radius);
        element.style.opacity = `${direction === 'opening' ? 1 : 1 - handoffProgress}`;

        if (rawProgress < 1) {
          activeAnimation.frameId = requestAnimationFrame(update);
          return;
        }

        element.remove();
        activeAnimation = null;
        resolve(true);
      };

      activeAnimation.frameId = requestAnimationFrame(update);
    });
  }

  return {
    getMeshScreenRect,
    open: (options) => animate({ ...options, direction: 'opening' }),
    close: (options) => animate({ ...options, direction: 'closing' }),
    cancel
  };
}
