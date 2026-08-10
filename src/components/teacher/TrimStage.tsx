"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyTrim,
  BRUSH_ERASE,
  BRUSH_KEEP,
  contentBox,
  DEFAULT_TRIM,
  scaleBrush,
  type TrimSettings,
} from "@/lib/trim";
import type { CropRect } from "./CropStage";

/** 미리보기로 다룰 최대 크기. 작게 다뤄야 슬라이더가 바로바로 반응한다 */
const PREVIEW_MAX = 720;
/** 저장할 때의 최대 크기. 부자재는 이 정도면 충분하다 */
const EXPORT_MAX = 900;

type Tool = "pick" | "erase" | "keep";
type Backdrop = "checker" | "dark" | "light";

type Snapshot = {
  brush: Uint8Array;
  keyColors: TrimSettings["keyColors"];
};

type Props = {
  image: HTMLImageElement;
  crop: CropRect;
  onDone: (result: { blob: Blob; url: string; width: number; height: number }) => void;
  onBack: () => void;
};

function makeCheckerPattern(context: CanvasRenderingContext2D) {
  const tile = document.createElement("canvas");
  tile.width = 16;
  tile.height = 16;
  const tileContext = tile.getContext("2d");
  if (!tileContext) return null;
  tileContext.fillStyle = "#ffffff";
  tileContext.fillRect(0, 0, 16, 16);
  tileContext.fillStyle = "#d7dde3";
  tileContext.fillRect(0, 0, 8, 8);
  tileContext.fillRect(8, 8, 8, 8);
  return context.createPattern(tile, "repeat");
}

/** ②~⑥ 배경 지우기 · 손질 · 미리보기 */
export function TrimStage({ image, crop, onDone, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushRef = useRef<Uint8Array>(new Uint8Array(0));
  const paintingRef = useRef(false);
  const frameRef = useRef(0);

  const [settings, setSettings] = useState<TrimSettings>(DEFAULT_TRIM);
  const [tool, setTool] = useState<Tool>("pick");
  const [brushSize, setBrushSize] = useState(18);
  const [backdrop, setBackdrop] = useState<Backdrop>("checker");
  const [brushVersion, setBrushVersion] = useState(0);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);

  /** 자른 부분을 미리보기 크기로 줄여 둔 원본 픽셀 */
  const work = useMemo(() => {
    const scale = Math.min(1, PREVIEW_MAX / Math.max(crop.width, crop.height));
    const width = Math.max(1, Math.round(crop.width * scale));
    const height = Math.max(1, Math.round(crop.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      width,
      height,
    );
    return { data: context.getImageData(0, 0, width, height), width, height };
  }, [image, crop]);

  /* ---------- 되돌리기 ---------- */

  const pushHistory = useCallback(() => {
    setHistory((prev) =>
      [
        ...prev,
        {
          brush: Uint8Array.from(brushRef.current),
          keyColors: settings.keyColors,
        },
      ].slice(-30),
    );
  }, [settings.keyColors]);

  const undo = useCallback(() => {
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      brushRef.current = Uint8Array.from(last.brush);
      setSettings((current) => ({ ...current, keyColors: last.keyColors }));
      setBrushVersion((version) => version + 1);
      return prev.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo]);

  /* ---------- 미리보기 그리기 ---------- */

  useEffect(() => {
    if (!work) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const count = work.width * work.height;
    if (brushRef.current.length !== count) brushRef.current = new Uint8Array(count);

    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const trimmed = applyTrim(work.data, settings, brushRef.current);

      const layer = document.createElement("canvas");
      layer.width = work.width;
      layer.height = work.height;
      layer.getContext("2d")?.putImageData(trimmed, 0, 0);

      context.clearRect(0, 0, work.width, work.height);
      if (backdrop === "checker") {
        const pattern = makeCheckerPattern(context);
        context.fillStyle = pattern ?? "#ffffff";
      } else {
        context.fillStyle = backdrop === "dark" ? "#1d242c" : "#ffffff";
      }
      context.fillRect(0, 0, work.width, work.height);
      context.drawImage(layer, 0, 0);
    });

    return () => cancelAnimationFrame(frameRef.current);
  }, [work, settings, brushVersion, backdrop]);

  /* ---------- 캔버스 조작 ---------- */

  const pointToPixel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!work) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * work.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * work.height);
    if (x < 0 || y < 0 || x >= work.width || y >= work.height) return null;
    return { x, y };
  };

  const paint = (x: number, y: number) => {
    if (!work) return;
    const mark = tool === "erase" ? BRUSH_ERASE : BRUSH_KEEP;
    // 미리보기 크기 기준으로 붓 굵기를 잡는다
    const radius = Math.max(1, Math.round((brushSize / 2) * (work.width / 620)));
    const brush = brushRef.current;
    for (let dy = -radius; dy <= radius; dy++) {
      const py = y + dy;
      if (py < 0 || py >= work.height) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        if (px < 0 || px >= work.width) continue;
        if (dx * dx + dy * dy > radius * radius) continue;
        brush[py * work.width + px] = mark;
      }
    }
    setBrushVersion((version) => version + 1);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointToPixel(event);
    if (!point || !work) return;
    pushHistory();

    if (tool === "pick") {
      const offset = (point.y * work.width + point.x) * 4;
      const color: [number, number, number] = [
        work.data.data[offset],
        work.data.data[offset + 1],
        work.data.data[offset + 2],
      ];
      setSettings((current) => ({
        ...current,
        keyColors: [...current.keyColors, color],
      }));
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    paintingRef.current = true;
    paint(point.x, point.y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!paintingRef.current) return;
    const point = pointToPixel(event);
    if (point) paint(point.x, point.y);
  };

  const stopPainting = () => {
    paintingRef.current = false;
  };

  /* ---------- 저장 ---------- */

  const finish = async () => {
    if (!work) return;
    setBusy(true);
    try {
      const scale = Math.min(1, EXPORT_MAX / Math.max(crop.width, crop.height));
      const width = Math.max(1, Math.round(crop.width * scale));
      const height = Math.max(1, Math.round(crop.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        width,
        height,
      );

      const ratio = width / work.width;
      const trimmed = applyTrim(
        context.getImageData(0, 0, width, height),
        {
          ...settings,
          // 미리보기에서 본 만큼 실제 크기에서도 깎이도록 배율을 맞춘다
          shrink: settings.shrink * ratio,
          feather: settings.feather * ratio,
        },
        scaleBrush(brushRef.current, work.width, work.height, width, height),
      );

      // 남은 부분만 딱 맞게 잘라 여백을 없앤다
      const box = contentBox(trimmed) ?? { x: 0, y: 0, width, height };
      const output = document.createElement("canvas");
      output.width = box.width;
      output.height = box.height;
      const outputContext = output.getContext("2d");
      if (!outputContext) return;
      const layer = document.createElement("canvas");
      layer.width = width;
      layer.height = height;
      layer.getContext("2d")?.putImageData(trimmed, 0, 0);
      outputContext.drawImage(
        layer,
        box.x,
        box.y,
        box.width,
        box.height,
        0,
        0,
        box.width,
        box.height,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        output.toBlob(resolve, "image/png"),
      );
      if (blob) {
        onDone({
          blob,
          url: URL.createObjectURL(blob),
          width: box.width,
          height: box.height,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!work) return null;

  const cursor = tool === "pick" ? "crosshair" : "cell";

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="flex-1">
        <canvas
          ref={canvasRef}
          width={work.width}
          height={work.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPainting}
          onPointerCancel={stopPainting}
          style={{ cursor }}
          className="max-h-[62vh] w-full touch-none rounded-lg object-contain shadow-sm"
        />
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-slate-500">미리보기 배경</span>
          {(
            [
              ["checker", "체크무늬"],
              ["dark", "어두운색"],
              ["light", "밝은색"],
            ] as [Backdrop, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setBackdrop(value)}
              className={`rounded-full px-3 py-1 font-bold ${
                backdrop === value
                  ? "bg-brand text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-slate-400">
            체크무늬가 비쳐 보이면 진짜로 뚫린 것입니다
          </span>
        </div>
      </div>

      <div className="w-full shrink-0 space-y-5 lg:w-72">
        <section>
          <p className="text-sm font-bold">② 배경색 찍기</p>
          <p className="mt-1 text-xs text-slate-500">
            사진에서 지울 배경을 콕 찍으세요. 밝은 쪽 어두운 쪽을 따로 찍어도 됩니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {settings.keyColors.map((color, index) => (
              <button
                key={`${color.join(",")}-${index}`}
                type="button"
                title="이 색 지정을 지웁니다"
                onClick={() => {
                  pushHistory();
                  setSettings((current) => ({
                    ...current,
                    keyColors: current.keyColors.filter((_, i) => i !== index),
                  }));
                }}
                className="h-8 w-8 rounded-md border border-slate-300 ring-offset-1 hover:ring-2 hover:ring-rose-400"
                style={{ background: `rgb(${color.join(",")})` }}
              />
            ))}
            {settings.keyColors.length === 0 && (
              <span className="text-xs text-slate-400">아직 찍은 색이 없습니다</span>
            )}
          </div>
        </section>

        <Slider
          label="③ 비슷한 정도"
          hint="세게 하면 배경이 잘 지워지지만 부자재까지 파입니다"
          min={0}
          max={160}
          value={settings.tolerance}
          onChange={(value) =>
            setSettings((current) => ({ ...current, tolerance: value }))
          }
        />

        <section>
          <p className="text-sm font-bold">④ 손으로 지우기</p>
          <div className="mt-2 flex gap-2">
            {(
              [
                ["pick", "스포이드"],
                ["erase", "지우개"],
                ["keep", "되살리기"],
              ] as [Tool, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTool(value)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                  tool === value ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Slider
            label="붓 굵기"
            min={4}
            max={80}
            value={brushSize}
            onChange={setBrushSize}
          />
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className="mt-2 w-full rounded-lg bg-slate-100 py-2 text-sm font-bold text-slate-600 disabled:opacity-40"
          >
            되돌리기 (Ctrl+Z)
          </button>
        </section>

        <section className="space-y-1">
          <p className="text-sm font-bold">⑤ 가장자리 다듬기</p>
          <Slider
            label="안쪽으로 줄이기"
            hint="배경색 테두리가 남을 때 올리세요"
            min={0}
            max={4}
            value={settings.shrink}
            onChange={(value) =>
              setSettings((current) => ({ ...current, shrink: value }))
            }
          />
          <Slider
            label="계단 모양 부드럽게"
            min={0}
            max={4}
            value={settings.feather}
            onChange={(value) =>
              setSettings((current) => ({ ...current, feather: value }))
            }
          />
        </section>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600"
          >
            ← 다시 자르기
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={busy}
            className="flex-1 rounded-lg bg-brand py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "만드는 중…" : "이대로 확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-bold">{label}</span>
        <span className="text-slate-400">{Math.round(value)}</span>
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-brand"
      />
    </div>
  );
}
