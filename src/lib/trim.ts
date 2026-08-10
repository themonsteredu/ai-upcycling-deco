/**
 * 부자재 사진에서 배경을 지우는 계산 부분.
 *
 * 화면과 분리해 두어야 미리보기(작게)와 저장(원본 크기)에서 같은 방법을 쓸 수 있다.
 */

/** 붓으로 건드리지 않은 곳 */
export const BRUSH_NONE = 0;
/** 지우개로 문지른 곳 — 무조건 투명 */
export const BRUSH_ERASE = 1;
/** 되살리기 붓으로 문지른 곳 — 무조건 남김 */
export const BRUSH_KEEP = 2;

export type TrimSettings = {
  /** 스포이드로 찍은 배경색들 */
  keyColors: [number, number, number][];
  /** 찍은 색과 이만큼 가까우면 지운다 (0~160) */
  tolerance: number;
  /** 가장자리를 안쪽으로 줄일 픽셀 수 — 배경색 테두리가 남는 것을 막는다 */
  shrink: number;
  /** 가장자리 계단 모양을 부드럽게 할 픽셀 수 */
  feather: number;
};

export const DEFAULT_TRIM: TrimSettings = {
  keyColors: [],
  tolerance: 45,
  shrink: 1,
  feather: 1,
};

/** 찍은 색과의 거리로 투명도를 정한다. 경계는 부드럽게 이어 준다. */
function alphaFromColors(
  rgba: Uint8ClampedArray,
  count: number,
  keys: number[],
  tolerance: number,
  brush: Uint8Array,
) {
  const alpha = new Uint8ClampedArray(count);
  // 경계가 칼같이 끊기지 않도록 여유 구간을 둔다
  const soft = Math.max(6, tolerance * 0.45);
  const keyCount = keys.length / 3;

  for (let i = 0; i < count; i++) {
    const mark = brush[i];
    if (mark === BRUSH_ERASE) {
      alpha[i] = 0;
      continue;
    }
    if (mark === BRUSH_KEEP) {
      alpha[i] = 255;
      continue;
    }
    // 원래 사진에서 이미 투명한 곳은 그대로 둔다
    const own = rgba[i * 4 + 3];
    if (own === 0) {
      alpha[i] = 0;
      continue;
    }
    if (keyCount === 0) {
      alpha[i] = own;
      continue;
    }

    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    let nearest = Infinity;
    for (let k = 0; k < keys.length; k += 3) {
      const dr = r - keys[k];
      const dg = g - keys[k + 1];
      const db = b - keys[k + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < nearest) nearest = d;
    }
    const distance = Math.sqrt(nearest);
    if (distance <= tolerance) alpha[i] = 0;
    else if (distance >= tolerance + soft) alpha[i] = own;
    else alpha[i] = (own * (distance - tolerance)) / soft;
  }
  return alpha;
}

/** 남은 부분을 사방으로 조금씩 깎는다 (가로·세로 두 번에 나눠 빠르게) */
function shrinkAlpha(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
) {
  if (radius <= 0) return alpha;
  const pass = (input: Uint8ClampedArray, horizontal: boolean) => {
    const output = new Uint8ClampedArray(input.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let lowest = 255;
        for (let d = -radius; d <= radius; d++) {
          const sx = horizontal ? x + d : x;
          const sy = horizontal ? y : y + d;
          if (sx < 0 || sy < 0 || sx >= width || sy >= height) {
            lowest = 0;
            break;
          }
          const value = input[sy * width + sx];
          if (value < lowest) lowest = value;
        }
        output[y * width + x] = lowest;
      }
    }
    return output;
  };
  return pass(pass(alpha, true), false);
}

/** 가장자리 계단 모양을 흐리게 만든다 */
function featherAlpha(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
) {
  if (radius <= 0) return alpha;
  const pass = (input: Uint8ClampedArray, horizontal: boolean) => {
    const output = new Uint8ClampedArray(input.length);
    const span = radius * 2 + 1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let d = -radius; d <= radius; d++) {
          const sx = horizontal ? Math.min(width - 1, Math.max(0, x + d)) : x;
          const sy = horizontal ? y : Math.min(height - 1, Math.max(0, y + d));
          sum += input[sy * width + sx];
        }
        output[y * width + x] = sum / span;
      }
    }
    return output;
  };
  return pass(pass(alpha, true), false);
}

/**
 * 설정대로 배경을 지운 그림 데이터를 만든다.
 * 원본 픽셀은 건드리지 않고 사본을 돌려준다.
 */
export function applyTrim(
  source: ImageData,
  settings: TrimSettings,
  brush: Uint8Array,
): ImageData {
  const { width, height, data } = source;
  const count = width * height;
  const keys = settings.keyColors.flat();

  let alpha: Uint8ClampedArray<ArrayBufferLike> = alphaFromColors(
    data,
    count,
    keys,
    settings.tolerance,
    brush,
  );
  alpha = shrinkAlpha(alpha, width, height, Math.round(settings.shrink));
  alpha = featherAlpha(alpha, width, height, Math.round(settings.feather));

  const output = new Uint8ClampedArray(data.length);
  output.set(data);
  for (let i = 0; i < count; i++) output[i * 4 + 3] = alpha[i];
  return new ImageData(output, width, height);
}

/** 붓 자국을 원본 크기로 늘린다 (미리보기에서 칠한 것을 저장할 때 쓴다) */
export function scaleBrush(
  brush: Uint8Array,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
) {
  if (fromWidth === toWidth && fromHeight === toHeight) return brush;
  const scaled = new Uint8Array(toWidth * toHeight);
  for (let y = 0; y < toHeight; y++) {
    const sy = Math.min(fromHeight - 1, Math.floor((y * fromHeight) / toHeight));
    for (let x = 0; x < toWidth; x++) {
      const sx = Math.min(fromWidth - 1, Math.floor((x * fromWidth) / toWidth));
      scaled[y * toWidth + x] = brush[sy * fromWidth + sx];
    }
  }
  return scaled;
}

/** 남은 부분만 딱 맞게 잘라낸다. 저장 직전에 여백을 없애는 용도. */
export function contentBox(image: ImageData, threshold = 8) {
  const { width, height, data } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
