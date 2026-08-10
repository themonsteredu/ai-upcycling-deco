import * as THREE from "three";

/**
 * 키링 본체 크기.
 * 가로는 사진마다 다르므로(고리 끈이 붙어 있다) 사진에서 읽어 정하고,
 * 세로와 두께만 여기서 고정한다. 쿠션 부분이 가로 2.7 : 세로 2.1 : 두께 0.7이 된다.
 */
export const CUSHION = {
  height: 2.1,
  depth: 0.7,
} as const;

/** 사진을 이 정도 격자로 줄여서 모양을 읽는다. 높을수록 매끈하지만 무거워짐 */
const GRID_MAX = 300;
/** 이 알파값 위를 "물건이 있는 곳"으로 본다 */
const ALPHA_CUT = 128;
/**
 * 격자를 만들 때만 쓰는 훨씬 느슨한 기준.
 *
 * 모양을 읽을 때 사진을 격자로 줄이므로, 가장자리 한두 칸은 흐릿해져
 * ALPHA_CUT 아래로 떨어진다. 그 칸을 버리면 실제 사진에는 아직 물건이 있는데
 * 격자가 먼저 끊겨 테두리가 계단처럼 보인다.
 * 그래서 격자는 넉넉히 만들어 두고, 실제 잘라내기는 원본 사진의 투명도에 맡긴다.
 */
const ALPHA_KEEP = 60;
/**
 * 가장 두꺼운 지점까지의 몇 %만 들어가면 최대 두께에 도달할지.
 * 낮을수록 넓고 평평하게 부풀고, 가장자리에서 급히 얇아진다.
 */
const PLATEAU = 0.55;
/**
 * 쿠션 본체를 가려내는 기준.
 * 세로로 가장 많이 차 있는 줄을 100%로 봤을 때 이 비율보다 성긴 줄은
 * 쿠션이 아니라 튀어나온 고리 끈으로 본다. (자르지는 않고 크기 계산에만 쓴다)
 */
const BODY_THRESHOLD = 0.4;

/**
 * 어떤 자리의 앞면이 얼마나 볼록한지 돌려준다 (0 ~ 두께의 절반).
 * 부자재를 이 곡면에 딱 붙여 놓는 데 쓴다.
 */
export type HeightSampler = (x: number, y: number) => number;

export type PillowShape = {
  geometry: THREE.BufferGeometry;
  /** 사진에 찍힌 것 전체가 차지하는 범위 (가운데가 0) */
  extent: { minX: number; maxX: number; minY: number; maxY: number };
  /** 천의 평균 색. 키링 속을 채우는 데 쓴다 */
  fabricColor: string;
  /** 고리 끈 끝. 고리를 걸 자리다. 끈이 없으면 null */
  strapTip: { x: number; y: number; outward: 1 | -1 } | null;
  /** 표면 높이를 물어볼 수 있는 자 */
  sampleHeight: HeightSampler;
};

export type InflateOptions = {
  /** 실루엣 세로 길이를 이 값에 맞춘다 */
  targetHeight?: number;
  /** 부풀릴 두께 */
  depth?: number;
  /** 최대 두께에 도달하는 지점 (0~1). 낮을수록 넓고 평평하게 부푼다 */
  plateau?: number;
  /**
   * true면 고리 끈처럼 성긴 부분을 뺀 몸통을 기준으로 크기를 맞춘다.
   * 키링 본체에는 켜고, 고리처럼 통짜인 물건에는 끈다.
   */
  useBodySpan?: boolean;
};

/** 사진을 격자로 줄여서 알파(투명도)만 뽑아낸다 */
async function readAlphaGrid(url: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();

  const scale = GRID_MAX / Math.max(image.naturalWidth, image.naturalHeight);
  const width = Math.max(2, Math.round(image.naturalWidth * scale));
  const height = Math.max(2, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("캔버스를 열 수 없습니다");
  context.imageSmoothingEnabled = true;
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return { alpha, rgb: data, width, height };
}

/** 천의 평균 색을 구한다. 속을 채울 때 겉감과 비슷한 색이어야 자연스럽다 */
function averageFabricColor(
  rgb: Uint8ClampedArray,
  alpha: Uint8Array,
  distance: Float32Array,
  deepest: number,
) {
  // 가장자리 그림자에 휘둘리지 않도록 충분히 안쪽만 센다
  const minDepth = deepest * 0.3;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] < 250 || distance[i] < minDepth) continue;
    r += rgb[i * 4];
    g += rgb[i * 4 + 1];
    b += rgb[i * 4 + 2];
    count++;
  }
  if (count === 0) return "#3a4a5e";
  // 속은 빛이 덜 드니 조금 어둡게
  const dim = (value: number) => Math.round((value / count) * 0.72);
  return `rgb(${dim(r)}, ${dim(g)}, ${dim(b)})`;
}

/** 각 지점이 실루엣 가장자리에서 얼마나 안쪽에 있는지 잰다 */
function distanceToEdge(alpha: Uint8Array, width: number, height: number) {
  const INF = 1e9;
  const distance = new Float32Array(width * height);
  for (let i = 0; i < distance.length; i++) {
    distance[i] = alpha[i] > ALPHA_CUT ? INF : 0;
  }

  const relax = (index: number, from: number, cost: number) => {
    const candidate = distance[from] + cost;
    if (candidate < distance[index]) distance[index] = candidate;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      // 사진 밖은 배경으로 친다
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        distance[index] = Math.min(distance[index], 1);
      }
      if (x > 0) relax(index, index - 1, 1);
      if (y > 0) relax(index, index - width, 1);
      if (x > 0 && y > 0) relax(index, index - width - 1, Math.SQRT2);
      if (x < width - 1 && y > 0) relax(index, index - width + 1, Math.SQRT2);
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      if (x < width - 1) relax(index, index + 1, 1);
      if (y < height - 1) relax(index, index + width, 1);
      if (x < width - 1 && y < height - 1) relax(index, index + width + 1, Math.SQRT2);
      if (x > 0 && y < height - 1) relax(index, index + width - 1, Math.SQRT2);
    }
  }
  return distance;
}

/** 값이 촘촘한 구간만 남긴다 (고리 끈처럼 성긴 부분을 걸러내는 용도) */
function denseSpan(counts: Int32Array) {
  let max = 0;
  for (const count of counts) if (count > max) max = count;
  if (max === 0) return null;
  const limit = max * BODY_THRESHOLD;
  let start = 0;
  let end = counts.length - 1;
  while (start < counts.length && counts[start] < limit) start++;
  while (end > start && counts[end] < limit) end--;
  return [start, end] as const;
}

/**
 * 사진 실루엣을 그대로 부풀려 통통한 쿠션을 만든다.
 *
 * 실루엣 안쪽으로 깊이 들어간 곳(쿠션 몸통)은 두껍게,
 * 가장자리에 가까운 곳(고리 끈처럼 얇은 부분)은 납작하게 부푼다.
 * 덕분에 사진을 자르지 않아도 끈이 어색하게 튀지 않는다.
 *
 * 재질 그룹 0 = 앞면, 그룹 1 = 뒷면.
 */
export async function createPillowFromImage(
  url: string,
  options: InflateOptions = {},
): Promise<PillowShape> {
  const targetHeight = options.targetHeight ?? CUSHION.height;
  const depth = options.depth ?? CUSHION.depth;
  const plateauRatio = options.plateau ?? PLATEAU;
  const useBodySpan = options.useBodySpan ?? true;

  const { alpha, rgb, width, height } = await readAlphaGrid(url);
  const distance = distanceToEdge(alpha, width, height);

  const columns = new Int32Array(width);
  let minX = width;
  let maxX = -1;
  let deepest = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (alpha[index] <= ALPHA_CUT) continue;
      columns[x]++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (distance[index] > deepest) deepest = distance[index];
    }
  }

  // 가로: 성긴 줄(고리 끈)을 뺀 촘촘한 구간이 쿠션 몸통이다
  const bodyX = useBodySpan
    ? denseSpan(columns)
    : ([minX, maxX] as const);
  if (!bodyX || deepest === 0 || maxX < 0) {
    throw new Error("사진에서 모양을 찾지 못했습니다");
  }

  // 세로: 몸통 구간 안에서 실루엣의 위아래 끝을 그대로 쓴다.
  // 베개 모양이라 위아래 가장자리가 오목해서, 촘촘한 정도로 재면 짧게 나온다.
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = bodyX[0]; x <= bodyX[1]; x++) {
      if (alpha[y * width + x] <= ALPHA_CUT) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      break;
    }
  }
  if (maxY < 0) throw new Error("사진에서 키링 모양을 찾지 못했습니다");

  // 몸통의 세로 길이가 정해진 값이 되도록 전체 크기를 맞춘다
  const unit = targetHeight / (maxY - minY + 1);
  const halfDepth = depth / 2;
  const centerX = (bodyX[0] + bodyX[1]) / 2;
  const centerY = (minY + maxY) / 2;
  const plateau = Math.max(1, deepest * plateauRatio);

  // 각 칸이 얼마나 부풀었는지 (0~1). 표면 높이를 물어볼 때 다시 쓴다.
  const swell = new Float32Array(width * height);
  for (let i = 0; i < swell.length; i++) {
    swell[i] = Math.sin((Math.min(1, distance[i] / plateau) * Math.PI) / 2);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const perSheet = width * height;

  for (let sheet = 0; sheet < 2; sheet++) {
    const sign = sheet === 0 ? 1 : -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        positions.push(
          (x - centerX) * unit,
          (centerY - y) * unit,
          sign * halfDepth * swell[y * width + x],
        );
        uvs.push(x / (width - 1), 1 - y / (height - 1));
      }
    }
  }

  /** 네 칸 사이를 부드럽게 이어 읽는다 */
  const sampleHeight: HeightSampler = (worldX, worldY) => {
    const gx = centerX + worldX / unit;
    const gy = centerY - worldY / unit;
    if (gx < 0 || gy < 0 || gx > width - 1 || gy > height - 1) return 0;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = gx - x0;
    const fy = gy - y0;
    const top =
      swell[y0 * width + x0] * (1 - fx) + swell[y0 * width + x1] * fx;
    const bottom =
      swell[y1 * width + x0] * (1 - fx) + swell[y1 * width + x1] * fx;
    return halfDepth * (top * (1 - fy) + bottom * fy);
  };

  const frontIndex: number[] = [];
  const backIndex: number[] = [];
  for (let sheet = 0; sheet < 2; sheet++) {
    const base = sheet * perSheet;
    const target = sheet === 0 ? frontIndex : backIndex;
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const a = y * width + x;
        const b = a + 1;
        const c = a + width;
        const d = c + 1;
        // 네 귀퉁이가 모두 완전히 투명한 칸만 버린다
        if (
          alpha[a] <= ALPHA_KEEP &&
          alpha[b] <= ALPHA_KEEP &&
          alpha[c] <= ALPHA_KEEP &&
          alpha[d] <= ALPHA_KEEP
        ) {
          continue;
        }
        // 격자의 세로 방향은 화면 아래쪽이므로, 앞장이 앞을 보게 하려면
        // 이 순서로 감아야 한다. (반대로 감으면 면이 뒤집혀 부자재가 파묻힌다)
        if (sheet === 0) {
          target.push(base + a, base + c, base + b, base + b, base + c, base + d);
        } else {
          target.push(base + a, base + b, base + c, base + b, base + d, base + c);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([...frontIndex, ...backIndex]);
  geometry.clearGroups();
  geometry.addGroup(0, frontIndex.length, 0);
  geometry.addGroup(frontIndex.length, backIndex.length, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  let silhouetteTop = height;
  let silhouetteBottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] <= ALPHA_CUT) continue;
      if (y < silhouetteTop) silhouetteTop = y;
      if (y > silhouetteBottom) silhouetteBottom = y;
      break;
    }
  }

  // 몸통 바깥으로 튀어나온 부분 = 고리 끈. 고리를 걸 자리를 찾아둔다.
  const leftGap = bodyX[0] - minX;
  const rightGap = maxX - bodyX[1];
  let strapTip: PillowShape["strapTip"] = null;
  if (useBodySpan && Math.max(leftGap, rightGap) > 2) {
    const outward: 1 | -1 = rightGap >= leftGap ? 1 : -1;
    const tipX = outward === 1 ? maxX : minX;
    let sum = 0;
    let count = 0;
    for (let y = 0; y < height; y++) {
      if (alpha[y * width + tipX] > ALPHA_CUT) {
        sum += y;
        count++;
      }
    }
    const tipY = count > 0 ? sum / count : centerY;
    strapTip = {
      x: (tipX - centerX) * unit,
      y: (centerY - tipY) * unit,
      outward,
    };
  }

  return {
    geometry,
    strapTip,
    sampleHeight,
    fabricColor: averageFabricColor(rgb, alpha, distance, deepest),
    extent: {
      minX: (minX - centerX) * unit,
      maxX: (maxX - centerX) * unit,
      minY: (centerY - silhouetteBottom) * unit,
      maxY: (centerY - silhouetteTop) * unit,
    },
  };
}
