"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
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

/** 금속 링과 스프링 손목줄 — 사진이 아니라 3D 도형으로 만든다 */
export const RING_RADIUS = 0.17;
/** 끈 끝에서 부속이 바깥으로 뻗는 길이 */
export const HARDWARE_REACH = 0.82;

function Hardware({ tip }: { tip: NonNullable<PillowShape["strapTip"]> }) {
  const coilGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const turns = 4;
    const steps = 96;
    const start = tip.x + tip.outward * 0.36;
    const length = 0.44;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 2 * turns;
      points.push(
        new THREE.Vector3(
          start + tip.outward * t * length,
          tip.y + Math.cos(angle) * 0.1,
          Math.sin(angle) * 0.1,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 180, 0.022, 8, false);
  }, [tip]);

  useEffect(() => () => coilGeometry.dispose(), [coilGeometry]);

  return (
    <group>
      {/* 금속 링 — 끈 끝에 살짝 겹쳐 걸어 둔다 */}
      <mesh position={[tip.x + tip.outward * 0.12, tip.y, 0]}>
        <torusGeometry args={[RING_RADIUS, 0.028, 16, 64]} />
        <meshStandardMaterial
          color="#aab2bd"
          roughness={0.3}
          metalness={0.45}
        />
      </mesh>

      {/* 스프링 손목줄 */}
      <mesh geometry={coilGeometry}>
        <meshStandardMaterial
          color="#b3bac4"
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>
    </group>
  );
}

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
      {shape.strapTip && <Hardware tip={shape.strapTip} />}
    </group>
  );
}
