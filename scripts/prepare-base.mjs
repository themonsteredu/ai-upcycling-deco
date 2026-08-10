/**
 * 키링 본체 사진 손질 스크립트
 *
 *   npm run prepare-base
 *
 * public/base/ 에 넣어둔 사진의 흰 배경을 투명하게 지운다.
 * 사진은 자르지 않는다. 고리 끈도 찍힌 그대로 남는다.
 *
 * 원본은 public/base/_original/ 로 옮겨 두므로 몇 번을 다시 돌려도 안전하다.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const BASE_DIR = path.join(process.cwd(), "public", "base");
const ORIGINAL_DIR = path.join(BASE_DIR, "_original");

/** 배경색과 이만큼 가까우면 완전히 지운다 */
const CLEAR_BELOW = 42;
/** 이만큼 멀면 그대로 둔다. 사이 구간은 반투명으로 부드럽게 처리한다 */
const KEEP_ABOVE = 92;
/**
 * 쿠션 몸통을 재는 기준. 자르는 데 쓰는 게 아니라,
 * 3D 크기가 맞는지 확인용으로 가로세로 비율을 알려주는 데만 쓴다.
 */
const BODY_THRESHOLD = 0.4;

function distance(r1, g1, b1, r2, g2, b2) {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/** 가장자리에서 시작해 배경색과 이어진 부분만 지운다 (가운데 밝은 부분은 남는다) */
function removeBackground(data, width, height) {
  const size = width * height;
  // 네 모서리 색의 평균을 배경색으로 본다
  const corners = [
    0,
    (width - 1) * 4,
    (size - width) * 4,
    (size - 1) * 4,
  ];
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const offset of corners) {
    br += data[offset];
    bg += data[offset + 1];
    bb += data[offset + 2];
  }
  br /= corners.length;
  bg /= corners.length;
  bb /= corners.length;

  const visited = new Uint8Array(size);
  const stack = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    const d = distance(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      br,
      bg,
      bb,
    );
    if (d >= KEEP_ABOVE) return; // 여기서부터는 물건이다
    // 배경에 가까울수록 더 투명하게
    const alpha =
      d <= CLEAR_BELOW
        ? 0
        : Math.round(((d - CLEAR_BELOW) / (KEEP_ABOVE - CLEAR_BELOW)) * 255);
    data[offset + 3] = Math.min(data[offset + 3], alpha);
    stack.push(x, y);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

/**
 * 쿠션 몸통이 사진 안에서 차지하는 범위를 잰다.
 *
 * 고리 끈은 쿠션보다 훨씬 얇아서, 세로로 채워진 정도를 세어 보면
 * 끈이 있는 줄만 유독 성기다. 그 줄을 빼면 몸통만 남는다.
 * (자르지는 않고 크기를 알려주는 데만 쓴다)
 */
function measureBody(data, width, height) {
  const columns = new Int32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 128) columns[x]++;
    }
  }

  const span = (counts) => {
    const max = Math.max(...counts);
    if (max === 0) return null;
    const limit = max * BODY_THRESHOLD;
    let start = 0;
    let end = counts.length - 1;
    while (start < counts.length && counts[start] < limit) start++;
    while (end > start && counts[end] < limit) end--;
    return [start, end];
  };

  const horizontal = span(columns);
  if (!horizontal) return null;

  // 세로는 몸통 구간 안에서 실루엣의 위아래 끝을 그대로 쓴다.
  // 베개 모양이라 위아래가 오목해서, 촘촘한 정도로 재면 짧게 나온다.
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = horizontal[0]; x <= horizontal[1]; x++) {
      if (data[(y * width + x) * 4 + 3] <= 128) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      break;
    }
  }
  if (bottom < 0) return null;

  return {
    width: horizontal[1] - horizontal[0] + 1,
    height: bottom - top + 1,
  };
}

/** 네 모서리가 이미 투명하면 배경 지우기를 건너뛴다 */
function alreadyTransparent(data, width, height) {
  const size = width * height;
  const corners = [0, (width - 1) * 4, (size - width) * 4, (size - 1) * 4];
  return corners.every((offset) => data[offset + 3] < 8);
}

async function prepare(fileName) {
  const originalPath = path.join(ORIGINAL_DIR, fileName);
  const outputPath = path.join(BASE_DIR, fileName);
  const beforeSize = fs.statSync(outputPath).size;

  // 원본을 아직 따로 보관하지 않았다면 지금 옮겨 둔다
  if (!fs.existsSync(originalPath)) {
    fs.mkdirSync(ORIGINAL_DIR, { recursive: true });
    fs.copyFileSync(outputPath, originalPath);
  }

  const { data, info } = await sharp(originalPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const skipped = alreadyTransparent(data, info.width, info.height);
  if (!skipped) removeBackground(data, info.width, info.height);

  // 사진은 자르지 않고 크기 그대로, 화질 손실 없이 최대한 압축해 저장한다.
  // 태블릿 30대가 한꺼번에 받아야 하므로 용량이 작을수록 좋다.
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(outputPath);

  const afterSize = fs.statSync(outputPath).size;
  const mb = (bytes) => (bytes / 1048576).toFixed(2);
  const body = measureBody(data, info.width, info.height);

  console.log(
    `  ${fileName}: ${skipped ? "배경 이미 투명" : "배경 지움"} · ` +
      `${mb(beforeSize)}MB → ${mb(afterSize)}MB` +
      (body
        ? ` · 쿠션 몸통 가로:세로 = ${(body.width / body.height).toFixed(2)} : 1`
        : ""),
  );
  return body ? body.width / body.height : null;
}

async function main() {
  if (!fs.existsSync(BASE_DIR)) {
    console.error("public/base 폴더가 없습니다.");
    process.exit(1);
  }

  const files = fs
    .readdirSync(BASE_DIR)
    .filter((file) => /-(front|back)\.(png|jpe?g)$/i.test(file));

  if (files.length === 0) {
    console.log("손질할 사진이 없습니다. public/base/ 에 사진을 넣어 주세요.");
    return;
  }

  console.log("사진을 손질합니다…");
  const aspects = [];
  for (const file of files.sort()) {
    const aspect = await prepare(file);
    if (aspect) aspects.push(aspect);
  }

  if (aspects.length > 0) {
    const average = aspects.reduce((a, b) => a + b, 0) / aspects.length;
    console.log(
      `\n쿠션 몸통 평균 비율 = 가로 ${(average * 2.1).toFixed(1)} : 세로 2.1` +
        `  (지시서 기준은 2.7 : 2.1 입니다)`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
