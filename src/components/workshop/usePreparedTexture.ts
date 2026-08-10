"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";

/**
 * 사진을 불러와 3D에 쓸 수 있게 손질한다.
 *
 * 불러온 원본은 여러 곳에서 함께 쓰이므로 그대로 고치지 않고 사본을 만들어 손댄다.
 * (사진 데이터 자체는 사본끼리 공유하므로 메모리가 두 배로 늘지는 않는다)
 *
 * @param mirrored 좌우를 뒤집어 입힐지 여부. 키링 뒷면에 쓴다.
 */
export function usePreparedTexture(url: string, mirrored = false) {
  const source = useTexture(url);

  return useMemo(() => {
    const texture = source.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    if (mirrored) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.x = -1;
      texture.offset.x = 1;
    }
    texture.needsUpdate = true;
    return texture;
  }, [source, mirrored]);
}
