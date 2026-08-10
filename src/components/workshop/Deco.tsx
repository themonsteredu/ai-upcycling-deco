"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { decoShapeParts } from "@/lib/deco-shapes";
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

/** 실을 꿰는 구멍 */
function Holes({
  holes,
  radius,
}: {
  holes: [number, number][];
  radius: number;
}) {
  if (holes.length === 0) return null;
  return (
    <>
      {holes.map(([x, y]) => (
        <mesh key={`${x},${y}`} position={[x, y, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius, radius, 0.2, 10]} />
          <meshStandardMaterial color="#1a1d20" roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

/** 앱에 들어 있는 3D 도형 부자재 */
function ShapeDeco({
  shape,
  color,
  onPointerDown,
}: {
  shape: Parameters<typeof decoShapeParts>[0];
  color: string;
  onPointerDown: Props["onPointerDown"];
}) {
  const parts = useMemo(() => decoShapeParts(shape), [shape]);
  return (
    <group>
      <mesh geometry={parts.body} position={[0, 0, 0.05]} onPointerDown={onPointerDown}>
        <meshStandardMaterial
          color={color}
          roughness={parts.glossy ? 0.22 : 0.95}
          metalness={parts.glossy ? 0.05 : 0}
        />
      </mesh>
      <Holes holes={parts.holes} radius={parts.holeRadius} />
    </group>
  );
}

/** 선생님이 넣은 실물 사진 부자재 */
function ImageDeco({
  imageUrl,
  aspect,
  size,
  onPointerDown,
}: {
  imageUrl: string;
  aspect: number | undefined;
  size: number;
  onPointerDown: Props["onPointerDown"];
}) {
  const texture = usePreparedTexture(imageUrl);

  // 사진의 가로세로 비율대로 붙인다. 긴 변을 기준으로 맞춘다.
  const [width, height] = useMemo(() => {
    const image = texture.image as { width?: number; height?: number } | undefined;
    const ratio = aspect ?? (image?.width ?? 1) / (image?.height ?? 1);
    return ratio >= 1 ? [size, size / ratio] : [size * ratio, size];
  }, [texture, aspect, size]);

  return (
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
  );
}

/** 키링 표면에 붙은 부자재 하나 */
export function Deco({ placement, material, selected, onPointerDown }: Props) {
  const quaternion = useMemo(
    () => new THREE.Quaternion(...placement.quaternion),
    [placement.quaternion],
  );

  const size = DECO_UNIT * material.baseScale * placement.size;

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
        <mesh position={[0, 0, -0.004]} scale={size}>
          <ringGeometry args={[0.62, 0.69, 40]} />
          <meshBasicMaterial color="#0DBDB9" transparent opacity={0.75} />
        </mesh>
      )}
      {material.kind === "shape" ? (
        <group scale={size}>
          <ShapeDeco
            shape={material.shape}
            color={placement.color ?? "#E4534A"}
            onPointerDown={onPointerDown}
          />
        </group>
      ) : (
        <ImageDeco
          imageUrl={material.imageUrl}
          aspect={material.aspect}
          size={size}
          onPointerDown={onPointerDown}
        />
      )}
    </group>
  );
}
