"use client";

import { useCallback, useRef, useState } from "react";
import { DENIM_PARTS } from "@/lib/denim-parts";
import type { JeansPhoto, JeansSide, JeansZone } from "@/lib/jeans-photo";

/**
 * 청바지 사진 준비 화면.
 *
 * 수업에 가져갈 진짜 청바지를 앞뒤로 찍어 올리고, 사진 위에서
 * 「여기가 뒷주머니」 하고 톡 찍으면 된다. 학생은 그 자리를 누른다.
 */

/** 폰 사진은 4MB가 넘는다. 긴 변을 이만큼으로 줄여 올린다 */
const MAX_PX = 1400;

function shrink(file: File) {
  return new Promise<string | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(
        1,
        MAX_PX / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = objectUrl;
  });
}

type Props = {
  initial: JeansPhoto | null;
  ready: boolean;
};

export function JeansSetup({ initial, ready }: Props) {
  const [jeans, setJeans] = useState<JeansPhoto | null>(initial);
  const [zones, setZones] = useState<JeansZone[]>(initial?.zones ?? []);
  const [side, setSide] = useState<JeansSide>("front");
  const [partId, setPartId] = useState<string>(DENIM_PARTS[0].id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const photoUrl = side === "front" ? jeans?.frontUrl : jeans?.backUrl;
  const zoneOf = (id: string) =>
    zones.find((zone) => zone.partId === id && zone.side === side) ?? null;
  const placed = zones.filter((zone) => zone.partId).length;

  const upload = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("사진을 올리는 중…");
    const dataUrl = await shrink(file);
    if (!dataUrl) {
      setBusy(false);
      setMessage("사진을 읽지 못했습니다");
      return;
    }
    const response = await fetch("/api/teacher/jeans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ front: dataUrl }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(json.error ?? "올리지 못했습니다");
      return;
    }
    setJeans(json.jeans as JeansPhoto);
    setZones([]);
    setSide("front");
    setMessage("사진을 올렸습니다. 이제 조각 자리를 찍어 주세요.");
  }, []);

  /**
   * 한쪽 사진만 갈아 끼운다.
   * 사진이 바뀌면 그 면에 찍어 둔 자리는 좌표가 안 맞으므로 함께 지운다.
   */
  const replace = useCallback(
    async (which: JeansSide, files: FileList | null) => {
      const file = files?.[0];
      if (!file || !jeans) return;
      setBusy(true);
      setMessage(which === "front" ? "앞면을 올리는 중…" : "뒷면을 올리는 중…");
      const dataUrl = await shrink(file);
      if (!dataUrl) {
        setBusy(false);
        setMessage("사진을 읽지 못했습니다");
        return;
      }
      const response = await fetch("/api/teacher/jeans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jeans.id, [which]: dataUrl }),
      });
      const json = await response.json();
      setBusy(false);
      if (!response.ok) {
        setMessage(json.error ?? "사진을 올리지 못했습니다");
        return;
      }
      setJeans({
        ...jeans,
        frontUrl: json.frontUrl ?? jeans.frontUrl,
        backUrl: which === "back" ? (json.backUrl ?? jeans.backUrl) : jeans.backUrl,
      });
      setZones((prev) => prev.filter((zone) => zone.side !== which));
      setSide(which);
      setMessage(
        which === "front"
          ? "앞면을 바꿨습니다. 앞면 자리를 다시 찍어 주세요."
          : "뒷면을 올렸습니다. 뒷면 자리를 찍어 주세요.",
      );
    },
    [jeans],
  );

  /** 사진 위를 누르면 지금 고른 조각의 자리를 거기로 옮긴다 */
  const place = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const stage = stageRef.current;
      if (!stage || !photoUrl) return;
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      setZones((prev) => {
        const rest = prev.filter(
          (zone) => !(zone.partId === partId && zone.side === side),
        );
        const before = prev.find(
          (zone) => zone.partId === partId && zone.side === side,
        );
        return [...rest, { partId, side, x, y, r: before?.r ?? 0.09 }];
      });
      setMessage(null);
    },
    [partId, side, photoUrl],
  );

  const resize = useCallback(
    (by: number) => {
      setZones((prev) =>
        prev.map((zone) =>
          zone.partId === partId && zone.side === side
            ? { ...zone, r: Math.min(0.4, Math.max(0.03, zone.r * by)) }
            : zone,
        ),
      );
    },
    [partId, side],
  );

  const save = useCallback(async () => {
    if (!jeans) return;
    setBusy(true);
    const response = await fetch("/api/teacher/jeans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: jeans.id, zones }),
    });
    setBusy(false);
    setMessage(
      response.ok
        ? "저장했습니다. 학생 화면에 바로 나옵니다."
        : "저장하지 못했습니다",
    );
  }, [jeans, zones]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="text-xl font-bold tracking-tight">청바지 사진 준비</h1>
      <p className="mt-2 leading-relaxed text-slate-600">
        학생들이 화면에서 해체할 청바지 사진입니다. <b>수업에 가져가지 않아도
        됩니다</b> — 안 입는 청바지를 아무 데서나 한 번 찍어 올리면 그걸로
        끝입니다. 올린 뒤 조각마다 자리를 한 번씩 찍어 주세요.
      </p>

      {!ready && (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
          Supabase 연결이 아직 준비되지 않았습니다.
        </p>
      )}

      {message && (
        <p className="mt-4 rounded-lg bg-brand-light p-3 text-sm font-medium text-brand-dark">
          {message}
        </p>
      )}

      {/*
        파일 고르는 칸은 화면이 어떻게 바뀌든 늘 있어야 한다.
        「사진이 없을 때」 화면 안에만 두었더니, 사진을 올린 뒤에는
        「다른 청바지로 바꾸기」를 눌러도 열 것이 없었다.
      */}
      <input
        ref={frontRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const files = event.target.files;
          event.target.value = "";
          if (jeans) void replace("front", files);
          else void upload(files);
        }}
      />
      <input
        ref={backRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const files = event.target.files;
          event.target.value = "";
          void replace("back", files);
        }}
      />

      {!jeans ? (
        <div className="mt-6 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center">
          <p className="font-bold">청바지를 펼쳐 놓고 앞면을 찍어 주세요</p>
          <p className="mt-1 text-sm text-slate-500">
            바닥에 평평하게 펴고 위에서 찍으면 조각을 찾기 좋습니다
          </p>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => frontRef.current?.click()}
            className="mt-5 rounded-xl bg-brand px-8 py-4 text-base font-bold text-white disabled:opacity-40"
          >
            {busy ? "올리는 중…" : "앞면 사진 올리기"}
          </button>
        </div>
      ) : (
        <>
          {/*
            사진만 올려 두고 자리를 안 찍으면 학생 화면이 텅 빈다.
            그게 제일 흔한 실수라 눈에 띄게 알려 준다.
          */}
          {placed === 0 && (
            <div className="mt-5 rounded-xl border-2 border-brand bg-brand-light p-4">
              <p className="font-bold text-brand-dark">
                아직 누를 자리를 하나도 안 찍었습니다
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                이대로 두면 학생 화면에 <b>이 사진이 나오지 않습니다.</b>{" "}
                오른쪽에서 조각을 하나 고르고, 사진에서 그 자리를 한 번 누르세요.
                그리고 아래 <b>저장하기</b> 를 누르면 끝입니다.
              </p>
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <div className="flex gap-2">
              {(["front", "back"] as JeansSide[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSide(value)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${
                    side === value
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {value === "front" ? "앞면" : "뒷면"}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  (side === "front" ? frontRef : backRef).current?.click()
                }
                className="ml-auto text-sm text-slate-400 underline disabled:opacity-40"
              >
                {busy
                  ? "올리는 중…"
                  : side === "front"
                    ? "앞면 사진 바꾸기"
                    : jeans.backUrl
                      ? "뒷면 사진 바꾸기"
                      : "뒷면 사진 올리기"}
              </button>
            </div>

            {photoUrl ? (
              <div
                ref={stageRef}
                onPointerDown={place}
                className="relative mt-3 cursor-crosshair overflow-hidden rounded-xl bg-slate-100 select-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className="w-full" draggable={false} />
                {zones
                  .filter((zone) => zone.side === side)
                  .map((zone) => {
                    const on = zone.partId === partId;
                    const part = DENIM_PARTS.find((p) => p.id === zone.partId);
                    return (
                      <div
                        key={`${zone.partId}-${zone.side}`}
                        className={`pointer-events-none absolute flex items-center justify-center rounded-full border-4 text-[11px] font-bold ${
                          on
                            ? "border-brand bg-brand/25 text-white"
                            : "border-white/80 bg-black/25 text-white"
                        }`}
                        style={{
                          left: `${zone.x * 100}%`,
                          top: `${zone.y * 100}%`,
                          width: `${zone.r * 200}%`,
                          aspectRatio: "1",
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        {part?.name}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center">
                <p className="text-sm leading-relaxed text-slate-500">
                  뒷면 사진은 아직 없습니다.
                  <br />
                  뒷주머니나 브랜드 라벨을 뒷면에서 찍고 싶을 때만 올리면 됩니다.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => backRef.current?.click()}
                  className="mt-4 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {busy ? "올리는 중…" : "뒷면 사진 올리기"}
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="rounded-lg bg-slate-800 px-3 py-2 text-xs leading-relaxed font-bold text-white">
              ① 조각을 고르고 → ② 사진에서 그 자리를 누르세요
            </p>
            <div className="mt-2 space-y-1.5">
              {DENIM_PARTS.map((part) => {
                const zone = zones.find((z) => z.partId === part.id);
                const on = partId === part.id;
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setPartId(part.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                      on ? "border-brand bg-brand-light" : "border-slate-200"
                    }`}
                  >
                    <span className="flex-1 font-bold">{part.name}</span>
                    <span
                      className={`text-xs ${zone ? "text-brand-dark" : "text-slate-300"}`}
                    >
                      {zone ? (zone.side === "front" ? "앞" : "뒤") : "아직"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!zoneOf(partId)}
                onClick={() => resize(0.85)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-bold disabled:opacity-30"
              >
                작게
              </button>
              <button
                type="button"
                disabled={!zoneOf(partId)}
                onClick={() => resize(1.18)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-bold disabled:opacity-30"
              >
                크게
              </button>
            </div>

            <button
              type="button"
              disabled={busy || placed === 0}
              onClick={() => void save()}
              className="mt-4 w-full rounded-xl bg-brand py-3 font-bold text-white disabled:opacity-40"
            >
              {busy ? "저장 중…" : `저장하기 (${placed}/${DENIM_PARTS.length})`}
            </button>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              자리를 안 찍은 조각은 학생 화면에 안 나옵니다. 여덟 개를 다 찍는
              것이 좋지만, 몇 개만 해도 수업은 돌아갑니다.
            </p>
          </div>
          </div>
        </>
      )}
    </main>
  );
}
