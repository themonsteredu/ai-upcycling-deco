"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { createPillowFromImage, type PillowShape } from "@/lib/pillow-geometry";
import type { Material } from "@/lib/workshop-types";
import { usePreparedTexture } from "./usePreparedTexture";

/** 고리의 기본 세로 길이. 키링 몸통(2.1)보다 조금 작다 */
export const HOOK_HEIGHT = 1.5;
/** 고리의 두께 */
const HOOK_DEPTH = 0.17;
/** 두께가 금방 최대에 이르도록 (납작한 판 모양이 된다) */
const HOOK_PLATEAU = 0.28;
/** 끈 끝에 살짝 겹쳐 걸리게 하는 길이 */
const OVERLAP = 0.16;

type Props = {
  material: Material;
  strapTip: NonNullable<PillowShape["strapTip"]>;
  /** 기본 크기 대비 배율 */
  scale: number;
};

/**
 * 키링 끈 끝에 걸리는 고리.
 *
 * 사진을 평평한 판으로 붙이면 옆에서 볼 때 사라지므로,
 * 키링 본체와 같은 방법으로 사진 실루엣에 두께를 넣어 3D로 만든다.
 */
export function Hook({ material, strapTip, scale }: Props) {
  const texture = usePreparedTexture(material.imageUrl);
  const mirrored = usePreparedTexture(material.imageUrl, true);
  const [shape, setShape] = useState<PillowShape | null>(null);

  useEffect(() => {
    let alive = true;
    let built: PillowShape | null = null;
    createPillowFromImage(material.imageUrl, {
      targetHeight: HOOK_HEIGHT * scale,
      depth: HOOK_DEPTH * scale,
      plateau: HOOK_PLATEAU,
      useBodySpan: false,
    })
      .then((result) => {
        built = result;
        if (alive) setShape(result);
        else result.geometry.dispose();
      })
      .catch((error) => {
        console.error("고리 모양을 만들지 못했습니다", error);
      });
    return () => {
      alive = false;
      built?.geometry.dispose();
    };
  }, [material.imageUrl, scale]);

  if (!shape) return null;

  // 고리의 안쪽 끝이 끈 끝에 살짝 걸치도록 옆으로 밀어 둔다
  const halfWidth = (shape.extent.maxX - shape.extent.minX) / 2;
  const x = strapTip.x + strapTip.outward * (halfWidth - OVERLAP);

  return (
    <mesh
      geometry={shape.geometry}
      position={[x, strapTip.y, 0]}
      raycast={() => null}
    >
      <meshStandardMaterial
        attach="material-0"
        map={texture}
        roughness={0.45}
        metalness={0.15}
        alphaTest={0.05}
        side={THREE.DoubleSide}
      />
      <meshStandardMaterial
        attach="material-1"
        map={mirrored}
        roughness={0.45}
        metalness={0.15}
        alphaTest={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
