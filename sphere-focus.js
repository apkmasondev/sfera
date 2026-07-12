import * as THREE from './vendor/three/three.module.min.js';

const FOCUS_DURATION = 620;
const RESTORE_DURATION = 520;

const COLORS = {
  normal: new THREE.Color(0xffffff),
  category: new THREE.Color(0xd8ffad),
  dimmed: new THREE.Color(0x718078)
};

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function createSphereFocusController({ group, camera, meshes, reducedMotion }) {
  let phase = 'idle';
  let selectedMesh = null;
  let activeCategory = '';
  let animation = null;

  const returnQuaternion = new THREE.Quaternion();
  const targetQuaternion = new THREE.Quaternion();
  const rotationDelta = new THREE.Quaternion();
  const currentDirection = new THREE.Vector3();
  const targetDirection = new THREE.Vector3();
  const groupWorldPosition = new THREE.Vector3();

  function finishAnimation() {
    if (!animation) return;
    group.quaternion.copy(animation.to);
    const onComplete = animation.onComplete;
    animation = null;
    onComplete?.();
  }

  function startAnimation(to, duration, onComplete) {
    animation = {
      from: group.quaternion.clone(),
      to: to.clone(),
      startedAt: performance.now(),
      duration,
      onComplete
    };

    if (reducedMotion.matches) finishAnimation();
  }

  function focus(mesh, category, onComplete) {
    if (phase !== 'idle' || !mesh) return false;

    phase = 'focusing';
    selectedMesh = mesh;
    activeCategory = category || '';
    returnQuaternion.copy(group.quaternion);

    currentDirection.copy(mesh.position).normalize().applyQuaternion(group.quaternion);
    group.getWorldPosition(groupWorldPosition);
    targetDirection.copy(camera.position).sub(groupWorldPosition).normalize();
    rotationDelta.setFromUnitVectors(currentDirection, targetDirection);
    targetQuaternion.copy(rotationDelta).multiply(group.quaternion).normalize();

    startAnimation(targetQuaternion, FOCUS_DURATION, () => {
      phase = 'focused';
      onComplete?.();
    });
    return true;
  }

  function restore(onComplete) {
    if (phase === 'idle' || phase === 'restoring') return false;

    phase = 'restoring';
    startAnimation(returnQuaternion, RESTORE_DURATION, () => {
      phase = 'idle';
      selectedMesh = null;
      activeCategory = '';
      onComplete?.();
    });
    return true;
  }

  function reset() {
    animation = null;
    phase = 'idle';
    selectedMesh = null;
    activeCategory = '';
  }

  function updateAnimation(now) {
    if (!animation) return;
    const progress = THREE.MathUtils.clamp((now - animation.startedAt) / animation.duration, 0, 1);
    group.quaternion.slerpQuaternions(animation.from, animation.to, easeInOutCubic(progress));
    if (progress >= 1) finishAnimation();
  }

  function updateMeshStyles(hoveredMesh) {
    const focusActive = phase !== 'idle';
    const smoothing = reducedMotion.matches ? 1 : 0.14;

    for (const mesh of meshes) {
      if (!mesh.userData.loaded) continue;

      const isSelected = focusActive && mesh === selectedMesh;
      const isCategory = focusActive && activeCategory && mesh.userData.category === activeCategory;
      const isHovered = !focusActive && mesh === hoveredMesh;

      let targetScale = 1;
      let targetOpacity = 0.9;
      let targetColor = COLORS.normal;

      if (focusActive) {
        if (isSelected) {
          targetScale = 1.5;
          targetOpacity = 1;
        } else if (isCategory) {
          targetScale = 1.12;
          targetOpacity = 0.98;
          targetColor = COLORS.category;
        } else {
          targetScale = 0.88;
          targetOpacity = 0.22;
          targetColor = COLORS.dimmed;
        }
      } else if (isHovered) {
        targetScale = 1.3;
        targetOpacity = 1;
      }

      mesh.scale.setScalar(THREE.MathUtils.lerp(mesh.scale.x, targetScale, smoothing));
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, targetOpacity, smoothing);
      mesh.material.color.lerp(targetColor, smoothing);
      mesh.renderOrder = isSelected ? 2 : isCategory ? 1 : 0;
    }
  }

  function update(now, hoveredMesh) {
    updateAnimation(now);
    updateMeshStyles(hoveredMesh);
  }

  return {
    focus,
    restore,
    reset,
    update,
    isIdle: () => phase === 'idle',
    isActive: () => phase !== 'idle'
  };
}
