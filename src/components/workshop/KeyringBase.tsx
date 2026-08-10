"use client";

import { useEffect, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { createPillowFromImage, type PillowShape } from "@/lib/pillow-geometry";
import type { BaseType } from "@/lib/workshop-types";
import { usePreparedTexture } from "./usePreparedTexture";

type Props = {
  baseType: BaseType;
  onSurfacePointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onSurfacePointerMove: (event: ThreeEvent<PointerEvent>) => void;
  /** 화면에 꽉 차게 맞추려면 전체 크기를 알아야 한다 */
  onShapeReady: (shape: PillowShape | null) => void;
};

export function KeyringBase({
  baseType,
  onSurfacePointerDown,
  onSurfacePointerMove,
  onShapeReady,
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
          alphaTest={0.5}
        />
        <meshStandardMaterial
          attach="material-1"
          map={back}
          roughness={0.92}
          metalness={0}
          alphaTest={0.5}
        />
      </mesh>
    </group>
  );
}
