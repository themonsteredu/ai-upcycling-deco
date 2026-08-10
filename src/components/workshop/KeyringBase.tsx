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
};

/** 금속 링과 스프링 손목줄 — 사진이 아니라 3D 도형으로 만든다 */
function Hardware({ tip }: { tip: NonNullable<PillowShape["strapTip"]> }) {
  const coilGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const turns = 5;
    const steps = 120;
    const start = tip.x + tip.outward * 0.58;
    const length = 0.62;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 2 * turns;
      points.push(
        new THREE.Vector3(
          start + tip.outward * t * length,
          tip.y + Math.cos(angle) * 0.13,
          Math.sin(angle) * 0.13,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 220, 0.028, 8, false);
  }, [tip]);

  useEffect(() => () => coilGeometry.dispose(), [coilGeometry]);

  return (
    <group>
      {/* 금속 링 — 끈 구멍을 통과하므로 끈과 직각인 평면에 놓는다 */}
      <mesh
        position={[tip.x + tip.outward * 0.22, tip.y, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.2, 0.032, 12, 40]} />
        <meshStandardMaterial color="#c8ced7" roughness={0.28} metalness={0.75} />
      </mesh>

      {/* 스프링 손목줄 */}
      <mesh geometry={coilGeometry}>
        <meshStandardMaterial color="#cfd4dc" roughness={0.32} metalness={0.7} />
      </mesh>
    </group>
  );
}

export function KeyringBase({
  baseType,
  onSurfacePointerDown,
  onSurfacePointerMove,
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
        if (alive) setShape(result);
        else result.geometry.dispose();
      })
      .catch((error) => {
        console.error("키링 모양을 만들지 못했습니다", error);
      });
    return () => {
      alive = false;
      built?.geometry.dispose();
    };
  }, [frontUrl]);

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
