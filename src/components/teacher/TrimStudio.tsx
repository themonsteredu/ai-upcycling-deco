"use client";

import { useCallback, useRef, useState } from "react";
import { splitAndTrim } from "@/lib/grid-split";
import { CropStage, type CropRect } from "./CropStage";
import { TrimStage } from "./TrimStage";

type Item = {
  name: string;
  image: HTMLImageElement;
};

type Result = {
  name: string;
  url: string;
  width: number;
  height: number;
};

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

/**
 * 처음 자르기 틀은 사진의 가운데 70%로 둔다.
 * 사진 전체로 두면 어디를 끌어도 "옮기기"로 잡혀서 틀을 줄일 수가 없다.
 */
function defaultCrop(image: HTMLImageElement): CropRect {
  const width = image.naturalWidth * 0.7;
  const height = image.naturalHeight * 0.7;
  return {
    x: (image.naturalWidth - width) / 2,
    y: (image.naturalHeight - height) / 2,
    width,
    height,
  };
}

/** 사진 한 장을 읽어 화면에 쓸 수 있는 형태로 만든다 */
function loadImage(file: File) {
  return new Promise<Item | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ name: baseName(file.name), image });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

export function TrimStudio() {
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"crop" | "trim">("crop");
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [squareLock, setSquareLock] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [dragging, setDragging] = useState(false);
  const [gridColumns, setGridColumns] = useState(3);
  const [gridRows, setGridRows] = useState(5);
  const [splitting, setSplitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = items[index] ?? null;

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const loaded = (
      await Promise.all(
        Array.from(files)
          .filter((file) => file.type.startsWith("image/"))
          .map(loadImage),
      )
    ).filter((item): item is Item => item !== null);
    if (loaded.length === 0) return;

    setItems((prev) => {
      const next = [...prev, ...loaded];
      // 처음 넣은 경우 첫 장에 맞춰 자르기 틀을 사진 전체로 둔다
      if (prev.length === 0) {
        setCrop(defaultCrop(loaded[0].image));
        setIndex(0);
        setStage("crop");
      }
      return next;
    });
  }, []);

  const goTo = useCallback(
    (nextIndex: number, list: Item[]) => {
      const item = list[nextIndex];
      if (!item) return;
      setIndex(nextIndex);
      setCrop(defaultCrop(item.image));
      setStage("crop");
    },
    [],
  );

  const handleDone = useCallback(
    (result: { blob: Blob; url: string; width: number; height: number }) => {
      const name = current?.name ?? `material-${results.length + 1}`;
      setResults((prev) => [
        ...prev,
        { name, url: result.url, width: result.width, height: result.height },
      ]);
      if (index + 1 < items.length) {
        goTo(index + 1, items);
      } else {
        // 다 끝났으면 사진 넣는 화면으로 돌아간다. 다듬은 결과는 아래에 남는다.
        setItems([]);
        setIndex(0);
        setStage("crop");
      }
    },
    [current, index, items, results.length, goTo],
  );

  /** 여러 개가 줄 맞춰 찍힌 사진을 칸 수대로 나눠 한 번에 만든다 */
  const splitCurrent = useCallback(async () => {
    if (!current) return;
    setSplitting(true);
    // 화면이 멈춘 것처럼 보이지 않게 한 번 쉬어 준다
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const pieces = splitAndTrim(current.image, gridColumns, gridRows);
      if (pieces.length === 0) return;
      const made = await Promise.all(
        pieces.map(async (piece) => {
          const blob = await (await fetch(piece.dataUrl)).blob();
          return {
            name: `${current.name}-${piece.index + 1}`,
            url: URL.createObjectURL(blob),
            width: 0,
            height: 0,
          };
        }),
      );
      setResults((prev) => [...prev, ...made]);
      const kept = pieces.filter((piece) => piece.keptBackground).length;
      if (kept > 0) {
        setNotice(
          `${pieces.length}개 중 ${kept}개는 재료 색이 배경과 너무 비슷해 배경째로 남겼습니다. ` +
            `그 칸만 따로 올려서 손으로 다듬어 주세요.`,
        );
      } else {
        setNotice(null);
      }
      // 이 사진은 다 썼으니 다음 장으로
      if (index + 1 < items.length) goTo(index + 1, items);
      else {
        setItems([]);
        setIndex(0);
        setStage("crop");
      }
    } finally {
      setSplitting(false);
    }
  }, [current, gridColumns, gridRows, index, items, goTo]);

  /* ---------- 사진이 아직 없을 때 ---------- */

  if (items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold">재료 다듬기</h1>
        <p className="mt-2 text-slate-600">
          찍어 온 부자재 사진의 배경을 여기서 바로 지웁니다. 다른 프로그램은 필요 없습니다.
        </p>

        <div className="mt-6 rounded-xl bg-brand-light p-5 text-sm leading-relaxed text-slate-700">
          <p className="font-bold text-brand-dark">사진을 잘 찍는 요령</p>
          <p className="mt-2">
            부자재를 <b>초록색이나 파란색 종이 위</b>에 올려놓고 찍으면 배경이 훨씬
            깨끗하게 지워집니다. 부자재 색과 겹치지 않는 색을 쓰세요.
          </p>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void addFiles(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition ${
            dragging ? "border-brand bg-brand-light" : "border-slate-300 bg-white"
          }`}
        >
          <p className="font-bold">사진을 여기로 끌어다 놓으세요</p>
          <p className="mt-1 text-sm text-slate-500">
            여러 장을 한 번에 놓으면 한 장씩 차례로 다듬습니다
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => void addFiles(event.target.files)}
          />
        </div>

        <ResultList results={results} notice={notice} />
      </div>
    );
  }

  /* ---------- 다듬는 중 ---------- */

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">재료 다듬기</h1>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
          {items.length}장 중 {index + 1}번째 · {current?.name}
        </span>
        <span className="rounded-full bg-brand-light px-3 py-1 text-sm font-bold text-brand-dark">
          {stage === "crop" ? "① 자르기" : "② ~ ⑥ 배경 지우기"}
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="ml-auto rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"
        >
          사진 더 넣기
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => void addFiles(event.target.files)}
        />
      </div>

      <div className="mt-6">
        {current && stage === "crop" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-slate-600">
              부자재 하나만 남도록 틀을 끌어 주세요. 옆에 걸친 다른 부자재는 여기서
              잘려 나갑니다.
            </p>
            <CropStage
              image={current.image}
              crop={crop}
              onCropChange={setCrop}
              squareLock={squareLock}
              onSquareLockChange={setSquareLock}
            />
            <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold">여러 개가 한 장에 찍혔나요?</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                부자재를 줄 맞춰 늘어놓고 찍은 사진이라면, 칸 수만 알려주시면
                한 번에 나눠서 배경까지 지워 드립니다. 칸마다 따로 지우므로
                사진 전체의 배경색이 조금씩 달라도 괜찮습니다.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  가로
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={gridColumns}
                    onChange={(event) =>
                      setGridColumns(
                        Math.min(12, Math.max(1, Number(event.target.value) || 1)),
                      )
                    }
                    className="w-16 rounded-md border border-slate-300 px-2 py-1"
                  />
                  칸
                </label>
                <label className="flex items-center gap-2">
                  세로
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={gridRows}
                    onChange={(event) =>
                      setGridRows(
                        Math.min(12, Math.max(1, Number(event.target.value) || 1)),
                      )
                    }
                    className="w-16 rounded-md border border-slate-300 px-2 py-1"
                  />
                  칸
                </label>
                <button
                  type="button"
                  onClick={() => void splitCurrent()}
                  disabled={splitting}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {splitting
                    ? "만드는 중…"
                    : `${gridColumns * gridRows}개로 나눠 한 번에 만들기`}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {index + 1 < items.length && (
                <button
                  type="button"
                  onClick={() => goTo(index + 1, items)}
                  className="rounded-lg bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600"
                >
                  이 사진 건너뛰기
                </button>
              )}
              <button
                type="button"
                onClick={() => setStage("trim")}
                className="rounded-lg bg-brand px-8 py-3 text-sm font-bold text-white"
              >
                다음 — 배경 지우기
              </button>
            </div>
          </div>
        )}

        {current && stage === "trim" && (
          <TrimStage
            key={`${index}-${crop.x}-${crop.y}-${crop.width}-${crop.height}`}
            image={current.image}
            crop={crop}
            onDone={handleDone}
            onBack={() => setStage("crop")}
          />
        )}
      </div>

      <ResultList results={results} notice={notice} />
    </div>
  );
}

function ResultList({
  results,
  notice,
}: {
  results: Result[];
  notice: string | null;
}) {
  if (results.length === 0) return null;
  return (
    <section className="mt-10 border-t border-slate-200 pt-6">
      <p className="font-bold">다듬기를 마친 재료 {results.length}개</p>
      {notice && (
        <p className="mt-3 rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
          {notice}
        </p>
      )}
      <p className="mt-1 text-sm text-slate-500">
        아직 저장 기능이 없어서 컴퓨터로 내려받는 것까지만 됩니다. 다음 단계에서
        재료함에 바로 들어가도록 이어붙일 예정입니다.
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        {results.map((result, index) => (
          <a
            key={`${result.name}-${index}`}
            href={result.url}
            download={`${result.name}.png`}
            className="w-32 rounded-lg border border-slate-200 bg-white p-2 text-center"
            style={{
              backgroundImage:
                "repeating-conic-gradient(#e7ebef 0% 25%, #ffffff 0% 50%)",
              backgroundSize: "16px 16px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt={result.name}
              className="mx-auto h-24 w-full object-contain"
            />
            <span className="mt-1 block truncate rounded bg-white/90 text-xs font-bold text-slate-600">
              내려받기
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
