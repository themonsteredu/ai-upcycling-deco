import { autoTrimSource, type AutoTrimResult } from "./auto-trim";

/**
 * 여러 개가 가지런히 찍힌 사진 한 장을 칸 수대로 나눠 하나씩 다듬는다.
 *
 * 부자재를 바닥에 줄 맞춰 늘어놓고 한 번에 찍은 사진을 쓰기 위한 것이다.
 * 칸마다 따로 배경을 지우므로, 사진 전체의 배경색이 조금씩 달라도
 * (조명이나 그림자 때문에) 칸 단위로는 잘 지워진다.
 */

/** 칸 안쪽에서 이만큼 잘라내고 시작한다. 옆 칸이 걸쳐 들어오는 것을 막는다 */
const INSET = 0.03;

export type GridPiece = AutoTrimResult & {
  index: number;
  /** 배경을 지웠더니 재료까지 사라져서, 배경째로 남겨 둔 칸 */
  keptBackground: boolean;
};

/**
 * 배경을 지운 뒤 남은 넓이가 칸의 이 비율보다 작으면
 * 재료까지 지워졌다고 보고 배경째로 남긴다.
 * (아이보리 천을 밝은 바탕에 놓고 찍은 경우가 여기에 걸린다)
 */
const TOO_MUCH_REMOVED = 0.12;

export function splitAndTrim(
  image: HTMLImageElement,
  columns: number,
  rows: number,
  punchHoles = false,
): GridPiece[] {
  const pieces: GridPiece[] = [];
  const cellWidth = image.naturalWidth / columns;
  const cellHeight = image.naturalHeight / rows;
  const insetX = cellWidth * INSET;
  const insetY = cellHeight * INSET;

  const cell = document.createElement("canvas");
  const context = cell.getContext("2d", { willReadFrequently: true });
  if (!context) return pieces;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const sx = column * cellWidth + insetX;
      const sy = row * cellHeight + insetY;
      const sw = cellWidth - insetX * 2;
      const sh = cellHeight - insetY * 2;

      cell.width = Math.max(1, Math.round(sw));
      cell.height = Math.max(1, Math.round(sh));
      context.clearRect(0, 0, cell.width, cell.height);
      context.drawImage(image, sx, sy, sw, sh, 0, 0, cell.width, cell.height);

      const index = row * columns + column;
      const trimmed = autoTrimSource(cell, cell.width, cell.height, punchHoles);

      // 남은 넓이가 너무 작으면 재료까지 지워진 것이다
      if (trimmed && trimmed.survivedRatio >= TOO_MUCH_REMOVED) {
        pieces.push({ ...trimmed, index, keptBackground: false });
        continue;
      }

      pieces.push({
        dataUrl: cell.toDataURL("image/png"),
        aspect: cell.width / cell.height,
        removedBackground: false,
        survivedRatio: 1,
        index,
        keptBackground: true,
      });
    }
  }
  return pieces;
}
