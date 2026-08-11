import { contentBox, featherAlpha, shrinkAlpha } from "./trim";

/**
 * 부자재 사진의 배경을 자동으로 지우고 딱 맞게 잘라낸다.
 *
 * 사진 가장자리에서 시작해 배경색과 이어진 부분만 지운다.
 * 그래서 부자재 한가운데의 밝은 반사광이 뚫리지 않고,
 * 배경이 복잡한 사진은 조금만 지워지고 만다 (망가뜨리지 않는다).
 *
 * 손으로 더 다듬고 싶으면 선생님 화면의 「재료 다듬기」를 쓰면 된다.
 */

/**
 * 어디까지 지울지.
 *
 * - `outside` 부자재 기본값. 바깥 배경만 조심스럽게 지운다.
 *   천 조각처럼 재료 색이 배경과 비슷하면 속까지 파먹히므로 기준을 좁게 잡는다.
 * - `holes` 단추·고리처럼 가운데가 뚫려 있어야 하는 것. 배경색이면 어디든 지운다.
 */
export type TrimMode = "outside" | "holes";

/** 모드별 기준. 앞은 "이만큼 가까우면 지운다", 뒤는 "이만큼 멀면 남긴다" */
const LIMITS: Record<TrimMode, { clearBelow: number; keepAbove: number }> = {
  outside: { clearBelow: 30, keepAbove: 64 },
  holes: { clearBelow: 44, keepAbove: 96 },
};

/** 다듬은 결과의 최대 크기 */
const MAX_PX = 384;
/** 잘라낸 뒤 사방에 남길 여백 */
const MARGIN = 2;

export type AutoTrimResult = {
  dataUrl: string;
  aspect: number;
  /** 배경을 실제로 지웠는지 (이미 투명한 사진이면 false) */
  removedBackground: boolean;
  /** 다듬고 남은 부분이 원래 사진에서 차지하던 비율 (0~1) */
  survivedRatio: number;
};

function cornerAverage(data: Uint8ClampedArray, width: number, height: number) {
  const size = width * height;
  const offsets = [0, (width - 1) * 4, (size - width) * 4, (size - 1) * 4];
  let r = 0;
  let g = 0;
  let b = 0;
  let opaque = 0;
  for (const offset of offsets) {
    r += data[offset];
    g += data[offset + 1];
    b += data[offset + 2];
    if (data[offset + 3] > 8) opaque++;
  }
  const n = offsets.length;
  return { r: r / n, g: g / n, b: b / n, opaque };
}

/** 가장자리에서 시작해 배경색과 이어진 부분만 투명하게 만든다 */
function floodRemove(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  key: { r: number; g: number; b: number },
  clearBelow: number,
  keepAbove: number,
) {
  const size = width * height;
  const alpha = new Uint8ClampedArray(size);
  for (let i = 0; i < size; i++) alpha[i] = data[i * 4 + 3];

  const visited = new Uint8Array(size);
  const stack: number[] = [];

  const visit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    const distance = Math.hypot(
      data[offset] - key.r,
      data[offset + 1] - key.g,
      data[offset + 2] - key.b,
    );
    if (distance >= keepAbove) return; // 여기서부터는 물건이다
    alpha[index] = Math.min(
      alpha[index],
      distance <= clearBelow
        ? 0
        : ((distance - clearBelow) / (keepAbove - clearBelow)) * 255,
    );
    stack.push(x, y);
  };

  for (let x = 0; x < width; x++) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    visit(0, y);
    visit(width - 1, y);
  }
  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }

  return alpha;
}

/** 사진 한 장을 자동으로 다듬는다 */
export function autoTrimImage(
  image: HTMLImageElement,
  mode: TrimMode = "outside",
): AutoTrimResult | null {
  return autoTrimSource(image, image.naturalWidth, image.naturalHeight, mode);
}

/** 사진뿐 아니라 잘라낸 조각(캔버스)도 다듬을 수 있게 한 것 */
export function autoTrimSource(
  input: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  mode: TrimMode = "outside",
): AutoTrimResult | null {
  const { clearBelow, keepAbove } = LIMITS[mode];
  const scale = Math.min(1, MAX_PX / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(input, 0, 0, width, height);

  const source = context.getImageData(0, 0, width, height);
  const corner = cornerAverage(source.data, width, height);
  const removedBackground = corner.opaque > 0;

  if (removedBackground) {
    let alpha: Uint8ClampedArray<ArrayBufferLike> = floodRemove(
      source.data,
      width,
      height,
      corner,
      clearBelow,
      keepAbove,
    );
    if (mode === "holes") {
      // 하트 고리 안쪽처럼 사방이 막힌 배경도 지운다
      for (let i = 0; i < width * height; i++) {
        const offset = i * 4;
        const distance = Math.hypot(
          source.data[offset] - corner.r,
          source.data[offset + 1] - corner.g,
          source.data[offset + 2] - corner.b,
        );
        if (distance <= clearBelow) alpha[i] = 0;
        else if (distance < keepAbove) {
          alpha[i] = Math.min(
            alpha[i],
            ((distance - clearBelow) / (keepAbove - clearBelow)) * 255,
          );
        }
      }
    }

    // 배경색 테두리가 남지 않게 한 겹 깎고, 계단 모양을 부드럽게
    alpha = shrinkAlpha(alpha, width, height, 1);
    alpha = featherAlpha(alpha, width, height, 1);
    for (let i = 0; i < width * height; i++) source.data[i * 4 + 3] = alpha[i];
    context.putImageData(source, 0, 0);
  }

  // 남은 부분만 딱 맞게 잘라 여백을 없앤다
  const box = contentBox(context.getImageData(0, 0, width, height));
  if (!box || box.width < 4 || box.height < 4) return null;

  const left = Math.max(0, box.x - MARGIN);
  const top = Math.max(0, box.y - MARGIN);
  const right = Math.min(width, box.x + box.width + MARGIN);
  const bottom = Math.min(height, box.y + box.height + MARGIN);

  const output = document.createElement("canvas");
  output.width = right - left;
  output.height = bottom - top;
  const outputContext = output.getContext("2d");
  if (!outputContext) return null;
  outputContext.drawImage(
    canvas,
    left,
    top,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height,
  );

  // 남은 부분이 얼마나 되는지 재 둔다.
  // 재료 색이 배경과 너무 비슷해 통째로 지워졌는지 판단하는 데 쓴다.
  const trimmed = context.getImageData(0, 0, width, height);
  let opaque = 0;
  for (let i = 3; i < trimmed.data.length; i += 4) {
    if (trimmed.data[i] > 128) opaque++;
  }

  return {
    dataUrl: output.toDataURL("image/png"),
    aspect: output.width / output.height,
    removedBackground,
    survivedRatio: opaque / (width * height),
  };
}
