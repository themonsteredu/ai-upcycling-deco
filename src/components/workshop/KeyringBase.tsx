"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { createPillowFromImage, type PillowShape } from "@/lib/pillow-geometry";
import type { BaseType, Material } from "@/lib/workshop-types";
import { Hook } from "./Hook";
import { usePreparedTexture } from "./usePreparedTexture";

type Props = {
  baseType: BaseType;
  onSurfacePointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onSurfacePointerMove: (event: ThreeEvent<PointerEvent>) => void;
  /** 화면에 꽉 차게 맞추려면 전체 크기를 알아야 한다 */
  onShapeReady: (shape: PillowShape | null) => void;
  /** 끈 끝에 걸 고리. 고르지 않았으면 null */
  hookMaterial: Material | null;
  hookScale: number;
  hookAngle: number;
};

export function KeyringBase({
  baseType,
  onSurfacePointerDown,
  onSurfacePointerMove,
  onShapeReady,
  hookMaterial,
  hookScale,
  hookAngle,
}: Props) {
  const frontUrl = `/base/${baseType}-front.png`;
  const front = usePreparedTexture(frontUrl);
  // 뒤에서 보면 좌우가 뒤집혀 보이므로 뒷면 사진만 미리 뒤집어 둔다.
  // (선생님은 사진을 뒤집지 않고 찍은 그대로 넣으면 된다)
  const back = usePreparedTexture(`/base/${baseType}-back.png`, true);

  const [shape, setShape] = useState<PillowShape | null>(null);

  useEffect(() => {
    let alive = true;
    let built: PillowShape | null = null;
    createPillowFromImage(frontUrl)
      .then((result) => {
        built = result;
        if (!alive) {
          result.geometry.dispose();
          return;
        }
        setShape(result);
        onShapeReady(result);
      })
      .catch((error) => {
        console.error("키링 모양을 만들지 못했습니다", error);
      });
    return () => {
      alive = false;
      built?.geometry.dispose();
    };
  }, [frontUrl, onShapeReady]);

  if (!shape) return null;

  return (
    <group>
      <mesh
        geometry={shape.geometry}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onSurfacePointerMove}
      >
        <meshStandardMaterial
          attach="material-0"
          map={front}
          roughness={0.92}
          metalness={0}
          /*
           * 앞뒤 두 겹이 만나는 솔기가 사진의 투명 경계와 겹친다.
           * 0.5로 자르면 그 줄이 통째로 사라져 옆에서 볼 때 속이 비친다.
           * 기준을 낮춰 솔기가 남게 한다.
           */
          alphaTest={0.05}
          side={THREE.DoubleSide}
        />
        <meshStandardMaterial
          attach="material-1"
          map={back}
          roughness={0.92}
          metalness={0}
          alphaTest={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/*
        속살 한 겹.
        겉감은 앞뒤 두 장이라 옆에서 보면 솔기 틈으로 속이 들여다보인다.
        같은 모양을 조금 작게 한 겹 더 두어 안이 꽉 차 보이게 한다.
        솜을 넣은 실제 키링과도 맞는 구조다.
      */}
      <mesh geometry={shape.geometry} scale={[0.985, 0.985, 0.86]} raycast={() => null}>
        <meshStandardMaterial
          color={shape.fabricColor}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {hookMaterial && shape.strapTip && (
        <Hook
          material={hookMaterial}
          strapTip={shape.strapTip}
          scale={hookScale}
          angle={hookAngle}
        />
      )}
    </group>
  );
}
