"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  DECO_LIFT,
  DECO_UNIT,
  type Material,
  type Placement,
} from "@/lib/workshop-types";
import { usePreparedTexture } from "./usePreparedTexture";

type Props = {
  placement: Placement;
  material: Material;
  selected: boolean;
  onPointerDown: (event: { stopPropagation: () => void }) => void;
};

/** 키링 표면에 붙은 부자재 한 장 */
export function Deco({ placement, material, selected, onPointerDown }: Props) {
  const texture = usePreparedTexture(material.imageUrl);
  const size = DECO_UNIT * material.baseScale * placement.size;

  // 사진의 가로세로 비율대로 붙인다. 긴 변을 기준으로 맞춘다.
  const [width, height] = useMemo(() => {
    const image = texture.image as { width?: number; height?: number } | undefined;
    const ratio = material.aspect ?? (image?.width ?? 1) / (image?.height ?? 1);
    return ratio >= 1 ? [size, size / ratio] : [size * ratio, size];
  }, [texture, material.aspect, size]);

  const quaternion = useMemo(
    () => new THREE.Quaternion(...placement.quaternion),
    [placement.quaternion],
  );

  const position = useMemo(() => {
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    /*
     * 평평한 부자재를 둥근 표면에 붙이면 가장자리가 표면 안으로 파묻힌다.
     * 클수록 더 많이 파묻히므로 크기의 제곱에 비례해 띄운다.
     */
    const lift = DECO_LIFT + 0.04 * size * size;
    return new THREE.Vector3(...placement.position).addScaledVector(normal, lift);
  }, [placement.position, quaternion, size]);

  return (
    <group position={position} quaternion={quaternion}>
      {selected && (
        <mesh position={[0, 0, -0.004]} scale={Math.max(width, height)}>
          <ringGeometry args={[0.6, 0.68, 40]} />
          <meshBasicMaterial color="#0DBDB9" transparent opacity={0.75} />
        </mesh>
      )}
      <mesh scale={[width, height, 1]} onPointerDown={onPointerDown}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={texture}
          alphaTest={0.4}
          roughness={0.9}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
