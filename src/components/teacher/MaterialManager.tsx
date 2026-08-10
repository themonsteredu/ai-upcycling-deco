"use client";

import { useCallback, useRef, useState } from "react";
import { autoTrimImage } from "@/lib/auto-trim";
import type { MaterialRow } from "@/lib/supabase";
import { HolePuncher } from "./HolePuncher";

type Kind = "deco" | "hook";
const CATEGORIES = ["천 조각", "단추", "얼굴 부속", "기타"] as const;

type Props = {
  initial: MaterialRow[];
  /** Supabase 연결이 준비되었는지 */
  ready: boolean;
};

/** 사진을 배경 지우고 잘라서 보낼 수 있는 형태로 만든다 */
function prepare(file: File, punchHoles: boolean) {
  return new Promise<string | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const result = autoTrimImage(image, punchHoles);
      URL.revokeObjectURL(objectUrl);
      resolve(result?.dataUrl ?? null);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = objectUrl;
  });
}

export function MaterialManager({ initial, ready }: Props) {
  const [rows, setRows] = useState<MaterialRow[]>(initial);
  const [kind, setKind] = useState<Kind>("deco");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [punching, setPunching] = useState<MaterialRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);

  const visible = rows.filter((row) => row.kind === kind);

  const say = (text: string | null) => setMessage(text);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      say("사진을 다듬는 중…");
      const made: MaterialRow[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        // 고리는 가운데 구멍까지 뚫는다
        const dataUrl = await prepare(file, kind === "hook");
        if (!dataUrl) continue;
        const response = await fetch("/api/teacher/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl,
            kind,
            name: file.name.replace(/\.[^.]+$/, "").slice(0, 20),
            category: kind === "hook" ? "기타" : "천 조각",
          }),
        });
        const json = await response.json();
        if (!response.ok) {
          say(json.error ?? "올리지 못했습니다");
          setBusy(false);
          return;
        }
        made.push(json.material as MaterialRow);
      }
      setRows((prev) => [...prev, ...made]);
      setBusy(false);
      say(`${made.length}개를 재료함에 넣었어요`);
    },
    [kind],
  );

  const patch = useCallback(
    async (id: string, body: Partial<MaterialRow>) => {
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...body } : row)),
      );
      const response = await fetch("/api/teacher/materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!response.ok) say("고치지 못했습니다");
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    if (!window.confirm("이 재료를 재료함에서 뺄까요?")) return;
    const response = await fetch(`/api/teacher/materials?id=${id}`, {
      method: "DELETE",
    });
    const json = await response.json();
    if (!response.ok) {
      say(json.error ?? "빼지 못했습니다");
      return;
    }
    if (json.hiddenInstead) {
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, is_active: false } : row)),
      );
      say(json.message);
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== id));
    say("재료함에서 뺐어요");
  }, []);

  /** 끌어서 순서 바꾸기 */
  const dropOn = useCallback(
    async (targetId: string) => {
      const sourceId = dragId.current;
      dragId.current = null;
      if (!sourceId || sourceId === targetId) return;

      const ordered = rows.filter((row) => row.kind === kind);
      const from = ordered.findIndex((row) => row.id === sourceId);
      const to = ordered.findIndex((row) => row.id === targetId);
      if (from < 0 || to < 0) return;

      const next = [...ordered];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      setRows((prev) => [...prev.filter((row) => row.kind !== kind), ...next]);
      await fetch("/api/teacher/materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((row) => row.id) }),
      });
    },
    [rows, kind],
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">재료함 관리</h1>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {(
            [
              ["deco", "부자재"],
              ["hook", "고리"],
            ] as [Kind, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`rounded-md px-4 py-1.5 font-bold ${
                kind === value ? "bg-white text-brand shadow-sm" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => fileRef.current?.click()}
          className="ml-auto rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "올리는 중…" : `+ ${kind === "hook" ? "고리" : "부자재"} 올리기`}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {!ready && (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
          Supabase 연결이 아직 준비되지 않았습니다. Vercel에 열쇠 네 개를 넣고
          다시 배포하면 여기서 재료를 올릴 수 있습니다.
        </p>
      )}

      <p className="mt-4 text-sm leading-relaxed text-slate-500">
        여기 올린 재료는 <b>모든 학생 화면에 똑같이</b> 나옵니다. 학생은 고르기만
        할 수 있고, 넣거나 뺄 수 없습니다. 사진을 올리면 배경은 자동으로 지워집니다.
      </p>

      {message && (
        <p className="mt-3 rounded-lg bg-brand-light p-3 text-sm font-medium text-brand-dark">
          {message}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
            아직 없습니다. 위 버튼으로 사진을 올려 주세요.
          </p>
        )}

        {visible.map((row) => (
          <div
            key={row.id}
            draggable
            onDragStart={() => {
              dragId.current = row.id;
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => void dropOn(row.id)}
            className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 ${
              row.is_active ? "" : "opacity-45"
            }`}
          >
            <span
              aria-hidden
              className="cursor-grab px-1 text-lg text-slate-300 select-none"
            >
              ⠿
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.image_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-contain"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(#eef1f4 0% 25%, #ffffff 0% 50%)",
                backgroundSize: "10px 10px",
              }}
            />
            <input
              value={row.name}
              onChange={(event) =>
                setRows((prev) =>
                  prev.map((item) =>
                    item.id === row.id ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
              onBlur={(event) => void patch(row.id, { name: event.target.value })}
              className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-slate-300"
            />
            {kind === "deco" && (
              <select
                value={row.category}
                onChange={(event) =>
                  void patch(row.id, { category: event.target.value })
                }
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setPunching(row)}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600"
            >
              구멍
            </button>
            <button
              type="button"
              onClick={() => void patch(row.id, { is_active: !row.is_active })}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                row.is_active
                  ? "bg-brand-light text-brand-dark"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {row.is_active ? "보임" : "숨김"}
            </button>
            <button
              type="button"
              onClick={() => void remove(row.id)}
              aria-label={`${row.name} 빼기`}
              className="rounded-md px-2 py-1 text-slate-300 hover:text-rose-500"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-slate-400">
        · 실물 부자재가 떨어지면 <b>숨김</b>으로 바꿔 주세요. 학생 화면에서 사라집니다.
        <br />· 이미 만든 작품에 쓰인 재료는 빼려고 해도 지워지지 않고 숨겨집니다.
        과거 작품이 깨지지 않게 하기 위해서입니다.
        <br />· 줄을 끌어서 순서를 바꿀 수 있습니다. 오늘 많이 쓸 재료를 위로 올리세요.
        <br />· <b>구멍</b> 을 누르면 단추 가운데의 실 구멍처럼 안쪽에 남은
        배경을 뚫을 수 있습니다.
      </p>

      {punching && (
        <HolePuncher
          material={punching}
          onClose={() => setPunching(null)}
          onSaved={(imageUrl) => {
            setRows((prev) =>
              prev.map((row) =>
                row.id === punching.id ? { ...row, image_url: imageUrl } : row,
              ),
            );
            setPunching(null);
            say("구멍을 뚫었어요");
          }}
        />
      )}
    </main>
  );
}
