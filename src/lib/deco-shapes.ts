import * as THREE from "three";
import type { ShapeId } from "./workshop-types";

/** 별 모양 */
function starShape() {
  const shape = new THREE.Shape();
  const outer = 0.5;
  const inner = 0.22;
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 ? inner : outer;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** 꽃잎 다섯 장 */
function flowerShape() {
  const shape = new THREE.Shape();
  const petals = 5;
  const outer = 0.3;
  const inner = 0.17;
  for (let i = 0; i < petals; i++) {
    const a0 = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / petals) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 1) / petals) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
    shape.quadraticCurveTo(
      Math.cos(a1) * outer * 1.9,
      Math.sin(a1) * outer * 1.9,
      Math.cos(a2) * inner,
      Math.sin(a2) * inner,
    );
  }
  shape.closePath();
  return shape;
}

function heartShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.38);
  shape.bezierCurveTo(0.58, 0.12, 0.36, 0.6, 0, 0.32);
  shape.bezierCurveTo(-0.36, 0.6, -0.58, 0.12, 0, -0.38);
  return shape;
}

function leafShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.46);
  shape.quadraticCurveTo(0.46, 0, 0, 0.5);
  shape.quadraticCurveTo(-0.46, 0, 0, -0.46);
  return shape;
}

function triangleShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.28);
  shape.lineTo(0.5, -0.28);
  shape.lineTo(0, 0.42);
  shape.closePath();
  return shape;
}

function extrude(shape: THREE.Shape, depth: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 28,
  });
  geometry.center();
  return geometry;
}

export type DecoShapeParts = {
  /** 색을 칠할 몸통 */
  body: THREE.BufferGeometry;
  /** 반질반질한 단추인지, 보송한 천인지 */
  glossy: boolean;
  /** 실을 꿰는 구멍 위치 */
  holes: [number, number][];
  holeRadius: number;
};

/**
 * 기본 재료의 3D 모양을 만든다.
 * 모양마다 새로 만들지 않도록 한 번 만든 것을 재사용한다.
 */
const cache = new Map<ShapeId, DecoShapeParts>();

export function decoShapeParts(shape: ShapeId): DecoShapeParts {
  const cached = cache.get(shape);
  if (cached) return cached;

  let parts: DecoShapeParts;
  switch (shape) {
    case "btnRound": {
      const body = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 30);
      body.rotateX(Math.PI / 2);
      parts = {
        body,
        glossy: true,
        holes: [
          [-0.1, 0.1],
          [0.1, 0.1],
          [-0.1, -0.1],
          [0.1, -0.1],
        ],
        holeRadius: 0.033,
      };
      break;
    }
    case "btnStar":
      parts = {
        body: extrude(starShape(), 0.11),
        glossy: true,
        holes: [
          [-0.07, 0],
          [0.07, 0],
        ],
        holeRadius: 0.03,
      };
      break;
    case "btnFlower":
      parts = {
        body: extrude(flowerShape(), 0.11),
        glossy: true,
        holes: [
          [-0.07, 0],
          [0.07, 0],
        ],
        holeRadius: 0.03,
      };
      break;
    case "square":
      parts = {
        body: new THREE.BoxGeometry(0.62, 0.62, 0.05),
        glossy: false,
        holes: [],
        holeRadius: 0,
      };
      break;
    case "circle": {
      const body = new THREE.CylinderGeometry(0.33, 0.33, 0.05, 30);
      body.rotateX(Math.PI / 2);
      parts = { body, glossy: false, holes: [], holeRadius: 0 };
      break;
    }
    case "triangle":
      parts = {
        body: extrude(triangleShape(), 0.05),
        glossy: false,
        holes: [],
        holeRadius: 0,
      };
      break;
    case "heart":
      parts = {
        body: extrude(heartShape(), 0.05),
        glossy: false,
        holes: [],
        holeRadius: 0,
      };
      break;
    case "leaf":
      parts = {
        body: extrude(leafShape(), 0.05),
        glossy: false,
        holes: [],
        holeRadius: 0,
      };
      break;
  }

  cache.set(shape, parts);
  return parts;
}
