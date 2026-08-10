"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { HeightSampler } from "@/lib/pillow-geometry";
import {
  DECO_BEND_RADIUS,
  DECO_LIFT,
  DECO_UNIT,
  type Material,
  type Placement,
} from "@/lib/workshop-types";
import { usePreparedTexture } from "./usePreparedTexture";

export type HandleKind = "resize" | "rotate";

/** 부자재를 가로세로 몇 칸으로 쪼개 곡면에 맞출지 */
const SEGMENTS = 18;

type Props = {
  placement: Placement;
  material: Material;
  selected: boolean;
  onPointerDown: (event: { stopPropagation: () => void }) => void;
  /** 모서리 손잡이를 잡았을 때 */
  onHandleDown?: (kind: HandleKind, event: ThreeEvent<PointerEvent>) => void;
  /** 키링 표면 높이를 물어볼 자. 아직 없으면 대충 휘어 붙인다 */
  sampleHeight?: HeightSampler;
};

/** 키링 표면에 붙은 부자재 한 장 */
export function Deco({
  placement,
  material,
  selected,
  onPointerDown,
  onHandleDown,
  sampleHeight,
}: Props) {
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

  const position = useMemo(
    () => new THREE.Vector3(...placement.position),
    [placement.position],
  );

  /*
   * 부자재는 평평한 판이 아니다.
   * 키링 앞면의 실제 높이를 자리마다 물어보고, 그 높이에 딱 맞게 판을
   * 구부린다. 그래서 아무리 크게 키워도 가장자리가 천 속으로 파묻히거나
   * 공중에 뜨지 않는다.
   */
  const localZ = useMemo(() => {
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const lift = DECO_LIFT + 0.012 * size;

    if (!sampleHeight) {
      // 표면을 아직 못 읽었으면 대략적인 곡률로 휘어 둔다
      return (x: number, y: number) =>
        lift - (x * x + y * y) / (2 * DECO_BEND_RADIUS);
    }

    const facing = normal.z >= 0 ? 1 : -1;
    // 옆면에 가까우면 나누기가 폭주하므로 바닥을 둔다
    const slope = facing * Math.max(0.35, Math.abs(normal.z));
    const point = new THREE.Vector3();

    return (x: number, y: number) => {
      point.set(x, y, 0).applyQuaternion(quaternion).add(position);
      const target = facing * (sampleHeight(point.x, point.y) + lift);
      return THREE.MathUtils.clamp((target - point.z) / slope, -0.7, 0.7);
    };
  }, [quaternion, position, size, sampleHeight]);

  const geometry = useMemo(() => {
    const shape = new THREE.PlaneGeometry(width, height, SEGMENTS, SEGMENTS);
    const attribute = shape.attributes.position;
    for (let i = 0; i < attribute.count; i++) {
      attribute.setZ(i, localZ(attribute.getX(i), attribute.getY(i)));
    }
    attribute.needsUpdate = true;
    shape.computeVertexNormals();
    return shape;
  }, [width, height, localZ]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  /** 고른 것을 감싸는 네모 테두리 */
  const outline = useMemo(() => {
    const halfWidth = width / 2 + 0.03;
    const halfHeight = height / 2 + 0.03;
    const corners: [number, number][] = [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [halfWidth, halfHeight],
      [-halfWidth, halfHeight],
    ];
    return new THREE.BufferGeometry().setFromPoints(
      corners.map(([x, y]) => new THREE.Vector3(x, y, localZ(x, y) + 0.012)),
    );
  }, [width, height, localZ]);

  useEffect(() => () => outline.dispose(), [outline]);

  return (
    <group position={position} quaternion={quaternion}>
      {selected && (
        <>
          <lineLoop geometry={outline} raycast={() => null}>
            <lineBasicMaterial color="#0DBDB9" transparent opacity={0.9} />
          </lineLoop>
          <Handle
            position={handleSpot(width / 2 + 0.03, -height / 2 - 0.03, localZ)}
            face="#0DBDB9"
            onPointerDown={(event) => onHandleDown?.("resize", event)}
          />
          <Handle
            position={handleSpot(0, height / 2 + 0.22, localZ)}
            face="#FFFFFF"
            onPointerDown={(event) => onHandleDown?.("rotate", event)}
          />
        </>
      )}
      <mesh geometry={geometry} onPointerDown={onPointerDown}>
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

/** 손잡이도 표면을 따라 얹는다 */
function handleSpot(
  x: number,
  y: number,
  localZ: (x: number, y: number) => number,
): [number, number, number] {
  return [x, y, localZ(x, y) + 0.03];
}

/**
 * 손가락으로도 잡히는 동그란 손잡이.
 * 보이는 것보다 훨씬 넓게 잡히도록 투명한 판을 하나 더 깐다.
 */
function Handle({
  position,
  face,
  onPointerDown,
}: {
  position: [number, number, number];
  face: string;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
}) {
  return (
    <group position={position}>
      <mesh onPointerDown={onPointerDown}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]} raycast={() => null}>
        <circleGeometry args={[0.085, 24]} />
        <meshBasicMaterial color="#0B1620" />
      </mesh>
      <mesh position={[0, 0, 0.002]} raycast={() => null}>
        <circleGeometry args={[0.065, 24]} />
        <meshBasicMaterial color={face} />
      </mesh>
    </group>
  );
}
