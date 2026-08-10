"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { usePreparedTexture } from "./usePreparedTexture";
import {
  STICKER_LIFT,
  STICKER_UNIT,
  type Material,
  type Placement,
} from "@/lib/workshop-types";

type Props = {
  placement: Placement;
  material: Material;
  selected: boolean;
  onPointerDown: (event: { stopPropagation: () => void }) => void;
};

/** 표면에 붙은 부자재 한 장. 투명 배경 PNG를 입힌 얇은 평면이다. */
export function Sticker({ placement, material, selected, onPointerDown }: Props) {
  const texture = usePreparedTexture(material.imageUrl);

  // 사진의 가로세로 비율을 읽어 찌그러지지 않게 한다. 긴 변을 기준으로 맞춘다.
  const [width, height] = useMemo(() => {
    const image = texture.image as { width?: number; height?: number } | undefined;
    const w = image?.width ?? 1;
    const h = image?.height ?? 1;
    const aspect = w / h;
    const long = STICKER_UNIT * material.baseScale * placement.size;
    return aspect >= 1 ? [long, long / aspect] : [long * aspect, long];
  }, [texture, material.baseScale, placement.size]);

  const quaternion = useMemo(
    () => new THREE.Quaternion(...placement.quaternion),
    [placement.quaternion],
  );

  const position = useMemo(() => {
    // 표면에서 살짝 띄워 본체와 겹쳐 깜빡이는 것을 막는다
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    return new THREE.Vector3(...placement.position).addScaledVector(
      normal,
      STICKER_LIFT,
    );
  }, [placement.position, quaternion]);

  return (
    <group position={position} quaternion={quaternion}>
      {selected && (
        <mesh position={[0, 0, -0.001]} scale={[width * 1.14, height * 1.14, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#0DBDB9" transparent opacity={0.85} />
        </mesh>
      )}
      <mesh scale={[width, height, 1]} onPointerDown={onPointerDown}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={texture}
          alphaTest={0.5}
          roughness={0.85}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
