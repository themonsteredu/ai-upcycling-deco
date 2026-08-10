"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { punchHoleAt } from "@/lib/punch";
import type { MaterialRow } from "@/lib/supabase";

type Props = {
  material: MaterialRow;
  onClose: () => void;
  /** 저장이 끝나면 새 사진 주소를 알려준다 */
  onSaved: (imageUrl: string) => void;
};

const CHECKER = {
  backgroundImage: "repeating-conic-gradient(#e7ebef 0% 25%, #ffffff 0% 50%)",
  backgroundSize: "14px 14px",
};

/**
 * 단추 구멍처럼 안쪽에 갇힌 배경을 뚫는 화면.
 * 구멍을 톡 누르면 그 자리와 색이 이어진 부분만 사라진다.
 */
export function HolePuncher({ material, onClose, onSaved }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const [ready, setReady] = useState(false);
  const [tolerance, setTolerance] = useState(70);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!alive || !canvas) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0);
      history.current = [];
      setReady(true);
    };
    image.onerror = () => {
      if (alive) setError("사진을 불러오지 못했습니다");
    };
    image.src = material.image_url;
    return () => {
      alive = false;
    };
  }, [material.image_url]);

  const punch = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !ready) return;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

      const before = context.getImageData(0, 0, canvas.width, canvas.height);
      const working = context.getImageData(0, 0, canvas.width, canvas.height);
      const { removed } = punchHoleAt(
        working.data,
        canvas.width,
        canvas.height,
        x,
        y,
        tolerance,
      );
      if (removed === 0) {
        setError("여기는 이미 뚫려 있거나 지울 것이 없습니다");
        return;
      }
      history.current = [...history.current, before];
      context.putImageData(working, 0, 0);
      setCount((value) => value + 1);
      setError(null);
    },
    [ready, tolerance],
  );

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const last = history.current[history.current.length - 1];
    if (!canvas || !last) return;
    history.current = history.current.slice(0, -1);
    canvas.getContext("2d")?.putImageData(last, 0, 0);
    setCount((value) => Math.max(0, value - 1));
    setError(null);
  }, []);

  const save = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/teacher/materials", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: material.id,
        dataUrl: canvas.toDataURL("image/png"),
      }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "저장하지 못했습니다");
      return;
    }
    onSaved(json.imageUrl as string);
  }, [material.id, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">구멍 뚫기 — {material.name}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          단추의 실 구멍처럼 <b>안쪽에 남은 배경</b>을 톡 누르면 사라집니다.
          구멍이 두 개면 두 번 누르세요.
        </p>

        <div
          className="mt-4 flex justify-center rounded-xl border border-slate-200 p-3"
          style={CHECKER}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={punch}
            className="max-h-[46dvh] w-auto max-w-full cursor-crosshair touch-none"
          />
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-slate-500">지우는 범위</span>
          <button
            type="button"
            onClick={() => setTolerance((v) => Math.max(20, v - 15))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold"
          >
            좁게
          </button>
          <span className="w-10 text-center font-bold">{tolerance}</span>
          <button
            type="button"
            onClick={() => setTolerance((v) => Math.min(160, v + 15))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold"
          >
            넓게
          </button>
          <span className="ml-auto text-slate-400">뚫은 곳 {count}</span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          구멍이 다 안 지워지면 <b>넓게</b>, 단추 몸통까지 지워지면{" "}
          <b>좁게</b> 로 바꾸고 되돌린 뒤 다시 눌러 보세요.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
          >
            취소
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={count === 0}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-40"
          >
            되돌리기
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || count === 0}
            className="ml-auto rounded-lg bg-brand px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
