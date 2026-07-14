import * as THREE from './vendor/three/three.module.min.js';
import { easeInOutCubic, MOTION } from './motion.js';

const COLORS = {
  normal: new THREE.Color(0xffffff),
  category: new THREE.Color(0xd8ffad),
  dimmed: new THREE.Color(0x718078)
};

export function createSphereFocusController({ group, camera, meshes, reducedMotion }) {
  let phase = 'idle';
  let selectedMesh = null;
  let activeCategory = '';
  let animation = null;
  let stylesDirty = false;
  let previousHoveredMesh = null;

  const returnQuaternion = new THREE.Quaternion();
  const targetQuaternion = new THREE.Quaternion();
  const rotationDelta = new THREE.Quaternion();
  const currentDirection = new THREE.Vector3();
  const targetDirection = new THREE.Vector3();
  const groupWorldPosition = new THREE.Vector3();
  const localUp = new THREE.Vector3(0, 1, 0);
  const localNormal = new THREE.Vector3(0, 0, 1);
  const meshUp = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const upCross = new THREE.Vector3();
  const cameraWorldQuaternion = new THREE.Quaternion();
  const meshReturnQuaternion = new THREE.Quaternion();
  const meshTargetQuaternion = new THREE.Quaternion();
  const rollQuaternion = new THREE.Quaternion();

  function finishAnimation() {
    if (!animation) return;
    group.quaternion.copy(animation.to);
    if (animation.mesh && animation.meshTo) animation.mesh.quaternion.copy(animation.meshTo);
    if (phase === 'restoring' && animation.mesh) animation.mesh.scale.setScalar(1);
    const onComplete = animation.onComplete;
    animation = null;
    onComplete?.();
  }

  function startAnimation(to, duration, onComplete, meshTo = null) {
    animation = {
      from: group.quaternion.clone(),
      to: to.clone(),
      mesh: selectedMesh,
      meshFrom: selectedMesh && meshTo ? selectedMesh.quaternion.clone() : null,
      meshTo: meshTo?.clone() || null,
      startedAt: performance.now(),
      duration,
      onComplete
    };

    if (reducedMotion.matches) finishAnimation();
  }

  function focus(mesh, category, onComplete) {
    if (phase !== 'idle' || !mesh) return false;

    phase = 'focusing';
    stylesDirty = true;
    selectedMesh = mesh;
    activeCategory = category || '';
    returnQuaternion.copy(group.quaternion);

    currentDirection.copy(mesh.position).normalize().applyQuaternion(group.quaternion);
    group.getWorldPosition(groupWorldPosition);
    targetDirection.copy(camera.position).sub(groupWorldPosition).normalize();
    rotationDelta.setFromUnitVectors(currentDirection, targetDirection);
    targetQuaternion.copy(rotationDelta).multiply(group.quaternion).normalize();

    meshReturnQuaternion.copy(mesh.quaternion);
    meshUp.copy(localUp).applyQuaternion(mesh.quaternion).applyQuaternion(targetQuaternion);
    meshUp.addScaledVector(targetDirection, -meshUp.dot(targetDirection)).normalize();
    camera.getWorldQuaternion(cameraWorldQuaternion);
    cameraUp.copy(camera.up).applyQuaternion(cameraWorldQuaternion);
    cameraUp.addScaledVector(targetDirection, -cameraUp.dot(targetDirection)).normalize();

    const rollAngle = Math.atan2(
      targetDirection.dot(upCross.crossVectors(meshUp, cameraUp)),
      meshUp.dot(cameraUp)
    );
    rollQuaternion.setFromAxisAngle(localNormal, rollAngle);
    meshTargetQuaternion.copy(meshReturnQuaternion).multiply(rollQuaternion).normalize();

    startAnimation(targetQuaternion, MOTION.focusDuration, () => {
      phase = 'focused';
      onComplete?.();
    }, meshTargetQuaternion);
    return true;
  }

  function restore(onComplete) {
    if (phase === 'idle' || phase === 'restoring') return false;

    phase = 'restoring';
    stylesDirty = true;
    startAnimation(returnQuaternion, MOTION.returnDuration, () => {
      phase = 'idle';
      selectedMesh = null;
      activeCategory = '';
      onComplete?.();
    }, meshReturnQuaternion);
    return true;
  }

  function reset() {
    if (selectedMesh) selectedMesh.quaternion.copy(meshReturnQuaternion);
    animation = null;
    phase = 'idle';
    selectedMesh = null;
    activeCategory = '';
    stylesDirty = true;
  }

  function interruptRestore() {
    if (phase !== 'restoring') return false;
    if (selectedMesh) selectedMesh.quaternion.copy(meshReturnQuaternion);
    animation = null;
    phase = 'idle';
    selectedMesh = null;
    activeCategory = '';
    stylesDirty = true;
    return true;
  }

  function updateAnimation(now) {
    if (!animation) return false;
    const progress = THREE.MathUtils.clamp((now - animation.startedAt) / animation.duration, 0, 1);
    group.quaternion.slerpQuaternions(animation.from, animation.to, easeInOutCubic(progress));
    if (animation.mesh && animation.meshFrom && animation.meshTo) {
      animation.mesh.quaternion.slerpQuaternions(animation.meshFrom, animation.meshTo, easeInOutCubic(progress));
    }
    if (progress >= 1) finishAnimation();
    return true;
  }

  function updateMeshStyles(hoveredMesh, delta) {
    if (hoveredMesh !== previousHoveredMesh) {
      previousHoveredMesh = hoveredMesh;
      stylesDirty = true;
    }

    const phaseAnimating = phase === 'focusing' || phase === 'restoring';
    if (!stylesDirty && !phaseAnimating) return false;

    const focusActive = phase !== 'idle';
    const smoothing = reducedMotion.matches ? 1 : 1 - Math.exp(-MOTION.styleResponse * delta);
    let unsettled = false;

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
          targetScale = phase === 'restoring' ? 1 : 1.5;
          targetOpacity = phase === 'restoring' ? 0.9 : 1;
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

      if (mesh.userData.transitionHidden) targetOpacity = 0;

      const nextScale = THREE.MathUtils.lerp(mesh.scale.x, targetScale, smoothing);
      mesh.scale.setScalar(Math.abs(nextScale - targetScale) < 0.001 ? targetScale : nextScale);
      const transitionOpacity = mesh.userData.transitionOpacity;
      const nextOpacity = Number.isFinite(transitionOpacity)
        ? THREE.MathUtils.clamp(transitionOpacity, 0, 1)
        : THREE.MathUtils.lerp(mesh.material.opacity, targetOpacity, smoothing);
      mesh.material.opacity = Math.abs(nextOpacity - targetOpacity) < 0.001 ? targetOpacity : nextOpacity;
      mesh.material.color.lerp(targetColor, smoothing);
      if (
        Math.abs(mesh.material.color.r - targetColor.r) < 0.001
        && Math.abs(mesh.material.color.g - targetColor.g) < 0.001
        && Math.abs(mesh.material.color.b - targetColor.b) < 0.001
      ) {
        mesh.material.color.copy(targetColor);
      }
      mesh.renderOrder = isSelected ? 2 : isCategory ? 1 : 0;

      unsettled ||= mesh.scale.x !== targetScale
        || mesh.material.opacity !== targetOpacity
        || !mesh.material.color.equals(targetColor);
    }

    stylesDirty = phaseAnimating || unsettled;
    return true;
  }

  function update(now, hoveredMesh, delta) {
    const animationChanged = updateAnimation(now);
    const stylesChanged = updateMeshStyles(hoveredMesh, delta);
    return animationChanged || stylesChanged;
  }

  return {
    focus,
    restore,
    interruptRestore,
    invalidateStyles: () => { stylesDirty = true; },
    reset,
    update,
    isIdle: () => phase === 'idle',
    isActive: () => phase !== 'idle'
  };
}
