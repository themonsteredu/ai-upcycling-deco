"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { Intro, QuizItem } from "@/lib/intro";
import { INTRO_CARDS } from "@/lib/intro-cards";

/**
 * 수업 도입 자료 준비 화면.
 *
 * 슬라이드는 파워포인트에서 사진으로 내보내 올린다.
 * 퀴즈는 물건 이름과 「될까 안 될까」, 그리고 이유 한 줄이면 된다.
 */

/** 프로젝터에 띄우기 좋을 만큼만. 더 키워 봐야 올리기만 느려진다 */
const MAX_PX = 1600;

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
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = objectUrl;
  });
}

export function IntroManager({
  initial,
  ready,
}: {
  initial: Intro;
  ready: boolean;
}) {
  const [slides, setSlides] = useState<string[]>(initial.slides);
  const [quiz, setQuiz] = useState<QuizItem[]>(initial.quiz);
  const [useCards, setUseCards] = useState(initial.useCards);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** 아직 안 올린 퀴즈 사진 */
  const photos = useRef<Map<string, string>>(new Map());

  const say = (text: string | null) => setMessage(text);

  const addSlides = useCallback(async (files: FileList | null) => {
    const picked = Array.from(files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (picked.length === 0) return;
    setBusy(true);
    say(`슬라이드 ${picked.length}장을 올리는 중…`);

    const dataUrls: string[] = [];
    for (const file of picked) {
      const one = await shrink(file);
      if (one) dataUrls.push(one);
    }
    const response = await fetch("/api/teacher/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slides: dataUrls }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      say(json.error ?? "올리지 못했습니다");
      return;
    }
    setSlides(json.slides as string[]);
    say(`슬라이드 ${dataUrls.length}장을 넣었습니다`);
  }, []);

  const saveSlides = useCallback(async (next: string[]) => {
    setSlides(next);
    await fetch("/api/teacher/intro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slides: next }),
    });
  }, []);

  const toggleCards = useCallback(async (next: boolean) => {
    setUseCards(next);
    const response = await fetch("/api/teacher/intro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useCards: next }),
    });
    if (!response.ok) {
      // 저장이 안 됐으면 스위치를 되돌려 놓는다. 안 그러면 켠 줄 알고 수업에 들어간다
      setUseCards(!next);
      say("바꾸지 못했습니다. 잠시 뒤 다시 눌러 주세요.");
      return;
    }
    say(
      next
        ? "카드뉴스를 씁니다. 발표 화면 맨 앞에 나옵니다."
        : "카드뉴스를 끕니다. 올리신 슬라이드부터 나옵니다.",
    );
  }, []);

  const move = (from: number, by: number) => {
    const to = from + by;
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    const [one] = next.splice(from, 1);
    next.splice(to, 0, one);
    void saveSlides(next);
  };

  const saveQuiz = useCallback(async () => {
    setBusy(true);
    const response = await fetch("/api/teacher/intro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quiz,
        photos: [...photos.current.entries()].map(([id, dataUrl]) => ({
          id,
          dataUrl,
        })),
      }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      say(json.error ?? "저장하지 못했습니다");
      return;
    }
    if (Array.isArray(json.quiz)) setQuiz(json.quiz as QuizItem[]);
    photos.current = new Map();
    say("퀴즈를 저장했습니다");
  }, [quiz]);

  const patchItem = (id: string, change: Partial<QuizItem>) =>
    setQuiz((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">수업 자료</h1>
        <Link
          href="/teacher/present"
          className="ml-auto rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white"
        >
          발표 시작하기
        </Link>
      </div>
      <p className="mt-2 leading-relaxed text-slate-600">
        프로젝터에 띄우는 화면입니다. 슬라이드로 업사이클링을 설명하고,
        「될까 말까」 퀴즈로 마무리합니다. 학생 태블릿에는 안 나옵니다.
      </p>

      {!ready && (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Supabase 연결이 아직 준비되지 않았습니다.
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-lg bg-brand-light p-3 text-sm font-medium text-brand-dark">
          {message}
        </p>
      )}

      {/* ── 앱에 들어 있는 카드뉴스 ── */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-bold">
            카드뉴스 {INTRO_CARDS.length}장{" "}
            <span className="font-normal text-slate-400">(앱에 들어 있음)</span>
          </h2>
          <button
            type="button"
            role="switch"
            aria-checked={useCards}
            disabled={!ready}
            onClick={() => void toggleCards(!useCards)}
            className={`ml-auto rounded-lg px-5 py-2.5 text-sm font-bold disabled:opacity-40 ${
              useCards
                ? "bg-brand text-white"
                : "border-2 border-slate-300 bg-white text-slate-500"
            }`}
          >
            {useCards ? "쓰는 중" : "안 씁니다"}
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          업사이클링을 설명하는 카드가 이미 만들어져 있습니다. 발표 화면 맨 앞에
          나오고, 마지막 장이 「아무거나 다 되는 건 아닙니다」로 끝나 아래 퀴즈로
          그대로 이어집니다. 직접 만드신 PPT만 쓰시려면 꺼 두세요.
        </p>

        <ol
          className={`mt-4 space-y-1.5 text-sm ${
            useCards ? "text-slate-600" : "text-slate-300"
          }`}
        >
          {INTRO_CARDS.map((card, index) => (
            <li key={card.headline} className="flex gap-2.5">
              <span className="w-4 shrink-0 text-right font-bold text-slate-400">
                {index + 1}
              </span>
              <span className="leading-relaxed">
                {card.kind === "number" && (
                  <b className="text-brand-dark">{card.big} · </b>
                )}
                {card.headline.replace("\n", " ")}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 슬라이드 ── */}
      <section className="mt-8">
        <div className="flex items-center gap-3">
          <h2 className="font-bold">슬라이드 {slides.length}장</h2>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => fileRef.current?.click()}
            className="ml-auto rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            {busy ? "올리는 중…" : "슬라이드 올리기"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              const files = event.target.files;
              event.target.value = "";
              void addSlides(files);
            }}
          />
        </div>

        <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm leading-relaxed text-slate-600">
          파워포인트에서 <b>파일 → 내보내기 → 그림으로</b> 하면 슬라이드가 한
          장씩 사진으로 나옵니다. 그 사진들을 한 번에 골라 올리세요. (PPT 파일
          자체는 브라우저에서 못 엽니다)
        </p>

        {slides.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            아직 없습니다. 슬라이드 없이 퀴즈만 해도 됩니다.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {slides.map((url, index) => (
              <div key={url} className="rounded-lg border border-slate-200 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full rounded" />
                <div className="mt-2 flex items-center gap-1 text-xs">
                  <span className="font-bold text-slate-400">{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    className="ml-auto rounded border border-slate-300 px-2 py-1"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void saveSlides(slides.filter((one) => one !== url))
                    }
                    className="rounded px-2 py-1 text-slate-400"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 퀴즈 ── */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <h2 className="font-bold">될까 말까 퀴즈 {quiz.length}개</h2>
          <button
            type="button"
            disabled={busy || !ready}
            onClick={() => void saveQuiz()}
            className="ml-auto rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy ? "저장 중…" : "퀴즈 저장하기"}
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          아래는 예시입니다. 고치고 지우고 더할 수 있습니다.{" "}
          <b>될 것 같은데 안 되는 것</b>과 <b>안 될 것 같은데 되는 것</b>을 섞어야
          아이들이 걸려듭니다.
        </p>

        <div className="mt-4 space-y-3">
          {quiz.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={item.name}
                  onChange={(event) =>
                    patchItem(item.id, { name: event.target.value })
                  }
                  placeholder="물건 이름"
                  className="min-w-40 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-bold"
                />
                <div className="flex gap-1">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => patchItem(item.id, { possible: value })}
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${
                        item.possible === value
                          ? value
                            ? "bg-brand text-white"
                            : "bg-rose-400 text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {value ? "됩니다" : "안 됩니다"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setQuiz((prev) => prev.filter((one) => one.id !== item.id))
                  }
                  className="rounded px-2 py-1 text-slate-300"
                  aria-label={`${item.name} 빼기`}
                >
                  ✕
                </button>
              </div>
              <input
                value={item.reason}
                onChange={(event) =>
                  patchItem(item.id, { reason: event.target.value })
                }
                placeholder="정답을 열었을 때 나올 한 줄"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-2 flex items-center gap-3">
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-12 w-12 rounded object-cover"
                  />
                )}
                <label className="text-xs text-slate-500">
                  <span className="cursor-pointer underline">
                    {item.imageUrl ? "사진 바꾸기" : "사진 넣기 (없어도 됨)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      const dataUrl = await shrink(file);
                      if (!dataUrl) return;
                      photos.current.set(item.id, dataUrl);
                      patchItem(item.id, { imageUrl: dataUrl });
                      say("사진을 넣었습니다. 아래 「퀴즈 저장하기」를 눌러 주세요.");
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setQuiz((prev) => [
              ...prev,
              {
                id: `q${prev.length + 1}-${Math.round(prev.length * 7 + 3)}`,
                name: "",
                possible: true,
                reason: "",
                imageUrl: null,
              },
            ])
          }
          className="mt-4 w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-bold text-slate-500"
        >
          + 문항 더하기
        </button>
      </section>
    </main>
  );
}
