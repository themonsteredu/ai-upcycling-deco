"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

export type CropRect = { x: number; y: number; width: number; height: number };

/** 화면에 그릴 최대 크기 */
const VIEW_MAX = 620;
/** 모서리 손잡이를 잡았다고 볼 거리 (화면 픽셀) */
const HANDLE_GRAB = 14;
const HANDLE_SIZE = 10;
/** 자르기 틀의 최소 크기 (원본 픽셀) */
const MIN_CROP = 24;

type Corner = "nw" | "ne" | "sw" | "se";
type Drag =
  | { kind: "new"; originX: number; originY: number }
  | { kind: "move"; grabX: number; grabY: number; start: CropRect }
  | { kind: "resize"; corner: Corner; anchorX: number; anchorY: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type Props = {
  image: HTMLImageElement;
  crop: CropRect;
  onCropChange: (crop: CropRect) => void;
  squareLock: boolean;
  onSquareLockChange: (value: boolean) => void;
};

/** ① 자르기 — 부자재 하나만 남기도록 사각형 틀을 끈다 */
export function CropStage({
  image,
  crop,
  onCropChange,
  squareLock,
  onSquareLockChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const scale = useMemo(
    () => Math.min(1, VIEW_MAX / Math.max(image.naturalWidth, image.naturalHeight)),
    [image],
  );

  const viewWidth = Math.round(image.naturalWidth * scale);
  const viewHeight = Math.round(image.naturalHeight * scale);

  /** 사진 밖으로 나가지 않게 다듬고, 정사각형 고정이면 짧은 변에 맞춘다 */
  const normalize = useCallback(
    (rect: CropRect): CropRect => {
      let { x, y, width, height } = rect;
      width = Math.max(MIN_CROP, width);
      height = Math.max(MIN_CROP, height);
      if (squareLock) {
        const side = Math.min(width, height);
        width = side;
        height = side;
      }
      width = Math.min(width, image.naturalWidth);
      height = Math.min(height, image.naturalHeight);
      x = clamp(x, 0, image.naturalWidth - width);
      y = clamp(y, 0, image.naturalHeight - height);
      return { x, y, width, height };
    },
    [image, squareLock],
  );

  useEffect(() => {
    onCropChange(normalize(crop));
    // 정사각형 고정을 켜고 끌 때만 다시 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareLock]);

  /* ---------- 그리기 ---------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewWidth === 0) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, viewWidth, viewHeight);
    context.drawImage(image, 0, 0, viewWidth, viewHeight);

    const box = {
      x: crop.x * scale,
      y: crop.y * scale,
      width: crop.width * scale,
      height: crop.height * scale,
    };

    // 틀 바깥을 어둡게
    context.fillStyle = "rgba(15, 23, 32, 0.55)";
    context.beginPath();
    context.rect(0, 0, viewWidth, viewHeight);
    context.rect(box.x, box.y + box.height, box.width, -box.height);
    context.fill("evenodd");

    context.strokeStyle = "#0DBDB9";
    context.lineWidth = 2;
    context.strokeRect(box.x, box.y, box.width, box.height);

    context.fillStyle = "#0DBDB9";
    for (const [cx, cy] of [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ]) {
      context.fillRect(
        cx - HANDLE_SIZE / 2,
        cy - HANDLE_SIZE / 2,
        HANDLE_SIZE,
        HANDLE_SIZE,
      );
    }
  }, [image, crop, scale, viewWidth, viewHeight]);

  /* ---------- 끌기 ---------- */

  const toSource = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
      viewX: event.clientX - rect.left,
      viewY: event.clientY - rect.top,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toSource(event);
    event.currentTarget.setPointerCapture(event.pointerId);

    const corners: [Corner, number, number][] = [
      ["nw", crop.x, crop.y],
      ["ne", crop.x + crop.width, crop.y],
      ["sw", crop.x, crop.y + crop.height],
      ["se", crop.x + crop.width, crop.y + crop.height],
    ];
    for (const [corner, cx, cy] of corners) {
      const near =
        Math.hypot(point.viewX - cx * scale, point.viewY - cy * scale) <
        HANDLE_GRAB;
      if (!near) continue;
      // 잡은 모서리의 반대편을 고정점으로 삼는다
      const anchorX = corner === "nw" || corner === "sw" ? crop.x + crop.width : crop.x;
      const anchorY = corner === "nw" || corner === "ne" ? crop.y + crop.height : crop.y;
      dragRef.current = { kind: "resize", corner, anchorX, anchorY };
      return;
    }

    const inside =
      point.x >= crop.x &&
      point.x <= crop.x + crop.width &&
      point.y >= crop.y &&
      point.y <= crop.y + crop.height;
    // 틀이 사진을 거의 다 덮고 있으면 안쪽을 끌어도 새로 그리게 한다.
    // 그렇지 않으면 틀을 줄일 방법이 없어진다.
    const coversAll =
      crop.width >= image.naturalWidth * 0.95 &&
      crop.height >= image.naturalHeight * 0.95;
    dragRef.current =
      inside && !coversAll
        ? { kind: "move", grabX: point.x - crop.x, grabY: point.y - crop.y, start: crop }
        : { kind: "new", originX: point.x, originY: point.y };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toSource(event);

    if (drag.kind === "move") {
      onCropChange(
        normalize({
          ...drag.start,
          x: point.x - drag.grabX,
          y: point.y - drag.grabY,
        }),
      );
      return;
    }

    const anchorX = drag.kind === "new" ? drag.originX : drag.anchorX;
    const anchorY = drag.kind === "new" ? drag.originY : drag.anchorY;
    let width = Math.abs(point.x - anchorX);
    let height = Math.abs(point.y - anchorY);
    if (squareLock) {
      const side = Math.min(width, height);
      width = side;
      height = side;
    }
    onCropChange(
      normalize({
        x: point.x < anchorX ? anchorX - width : anchorX,
        y: point.y < anchorY ? anchorY - height : anchorY,
        width,
        height,
      }),
    );
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={viewWidth}
        height={viewHeight}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="cursor-crosshair touch-none rounded-lg bg-slate-100 shadow-sm"
      />
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={squareLock}
            onChange={(event) => onSquareLockChange(event.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          정사각형으로 고정
        </label>
        <button
          type="button"
          onClick={() =>
            onCropChange({
              x: 0,
              y: 0,
              width: image.naturalWidth,
              height: image.naturalHeight,
            })
          }
          className="rounded-full bg-slate-100 px-3 py-1.5 font-bold text-slate-600"
        >
          사진 전체
        </button>
        <span className="text-slate-400">
          자를 범위 {Math.round(crop.width)} × {Math.round(crop.height)}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        빈 곳을 끌면 새로 그리고, 틀 안을 끌면 옮기고, 모서리 네모를 끌면 크기가 바뀝니다.
      </p>
    </div>
  );
}
