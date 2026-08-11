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
  /** 고리를 돌린 각도 (도) */
  angle: number;
  /** 좌우를 뒤집을지. 카라비너처럼 좌우가 있는 물건에 쓴다 */
  flip: boolean;
};

/**
 * 키링 끈 끝에 걸리는 고리.
 *
 * 사진을 평평한 판으로 붙이면 옆에서 볼 때 사라지므로,
 * 키링 본체와 같은 방법으로 사진 실루엣에 두께를 넣어 3D로 만든다.
 */
export function Hook({ material, strapTip, scale, angle, flip }: Props) {
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

  // 돌린 뒤의 가로 반지름을 다시 재서, 어떤 각도로 돌려도
  // 고리의 안쪽 끝이 끈 끝에 똑같이 걸치도록 한다
  const radians = (angle * Math.PI) / 180;
  const halfWidth = (shape.extent.maxX - shape.extent.minX) / 2;
  const halfHeight = (shape.extent.maxY - shape.extent.minY) / 2;
  const reach =
    Math.abs(halfWidth * Math.cos(radians)) +
    Math.abs(halfHeight * Math.sin(radians));
  const x = strapTip.x + strapTip.outward * (reach - OVERLAP);

  /*
   * 뒤집기는 크기를 -1로 만드는 대신 세로축으로 반 바퀴 돌린다.
   * 실제로 물건을 뒤집어 놓는 것과 같아서 면이 뒤집히거나 그림자가
   * 이상해지지 않는다. 돌린 각도는 부호를 뒤집어야 화면에서 같은 방향으로 돈다.
   *
   * 다만 뒷장에는 원래 「뒤에서 봐도 똑바로 보이도록」 좌우 반전 사진이
   * 들어 있다. 그대로 돌리면 두 번 뒤집혀 상쇄되므로, 뒤집을 때는
   * 앞뒤 사진을 맞바꾼다.
   */
  const faceMap = flip ? mirrored : texture;
  const backMap = flip ? texture : mirrored;

  return (
    <mesh
      geometry={shape.geometry}
      position={[x, strapTip.y, 0]}
      rotation={[0, flip ? Math.PI : 0, flip ? -radians : radians]}
      raycast={() => null}
    >
      <meshStandardMaterial
        attach="material-0"
        map={faceMap}
        roughness={0.45}
        metalness={0.15}
        alphaTest={0.05}
        side={THREE.DoubleSide}
      />
      <meshStandardMaterial
        attach="material-1"
        map={backMap}
        roughness={0.45}
        metalness={0.15}
        alphaTest={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
