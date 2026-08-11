"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Intro, QuizItem } from "@/lib/intro";
import { INTRO_CARDS, type IntroCard } from "@/lib/intro-cards";
import { IntroCardView } from "./IntroCardView";

/**
 * 프로젝터에 띄우는 발표 화면.
 *
 * 슬라이드를 다 넘기면 「될까 말까」 퀴즈로 이어진다.
 * 교실 뒤에서도 읽혀야 하므로 글씨를 아주 크게 쓴다.
 */

type Step =
  | { kind: "card"; card: IntroCard }
  | { kind: "slide"; url: string }
  | { kind: "quiz"; item: QuizItem }
  | { kind: "end" };

/*
 * 카드뉴스가 먼저, 선생님이 올린 슬라이드가 그다음, 퀴즈가 마지막이다.
 * 카드뉴스 마지막 장이 「아무거나 되는 건 아니다」로 끝나므로 퀴즈로 바로 이어진다.
 */
function buildSteps(intro: Intro, withCards: boolean): Step[] {
  return [
    ...(withCards
      ? INTRO_CARDS.map((card) => ({ kind: "card", card }) as const)
      : []),
    ...intro.slides.map((url) => ({ kind: "slide", url }) as const),
    ...intro.quiz.map((item) => ({ kind: "quiz", item }) as const),
    { kind: "end" } as const,
  ];
}

export function Present({
  intro,
  withCards = true,
}: {
  intro: Intro;
  withCards?: boolean;
}) {
  const steps = buildSteps(intro, withCards);
  const [at, setAt] = useState(0);
  /** 퀴즈에서 정답을 열었는지 */
  const [revealed, setRevealed] = useState(false);

  const step = steps[Math.min(at, steps.length - 1)];

  const go = useCallback(
    (by: number) => {
      setAt((now) => {
        const next = Math.min(steps.length - 1, Math.max(0, now + by));
        return next;
      });
      setRevealed(false);
    },
    [steps.length],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (steps.length <= 1) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0B1620] px-8 text-center text-white">
        <p className="text-2xl font-bold">아직 자료가 없습니다</p>
        <p className="text-slate-400">
          선생님 화면에서 슬라이드를 올리거나 퀴즈를 만들어 주세요.
        </p>
        <Link href="/teacher/intro" className="mt-4 font-bold text-brand">
          수업 자료 준비하러 가기
        </Link>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col bg-[#0B1620] text-white">
      {/* 좌우 절반을 눌러 넘긴다. 리모컨이나 화살표 키도 된다 */}
      <button
        type="button"
        aria-label="이전"
        onClick={() => go(-1)}
        className="absolute inset-y-0 left-0 z-10 w-1/4 cursor-w-resize"
      />
      <button
        type="button"
        aria-label="다음"
        onClick={() => go(1)}
        className="absolute inset-y-0 right-0 z-10 w-1/4 cursor-e-resize"
      />

      <div className="flex flex-1 items-center justify-center p-6">
        {step.kind === "card" && <IntroCardView card={step.card} />}

        {step.kind === "slide" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={step.url}
            alt=""
            className="max-h-[88dvh] max-w-full object-contain"
          />
        )}

        {step.kind === "quiz" && (
          <QuizView
            item={step.item}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
          />
        )}

        {step.kind === "end" && (
          <div className="text-center">
            <p className="text-2xl text-slate-400">이제 여러분 차례입니다</p>
            <p className="mt-6 text-6xl leading-tight font-bold">
              버려질 청바지로
              <br />
              <span className="text-brand">내 키링</span>을 만들어 봅시다
            </p>
          </div>
        )}
      </div>

      <p className="pb-4 text-center text-sm text-slate-500">
        {at + 1} / {steps.length} · 화면 양옆을 누르거나 화살표 키로 넘깁니다
      </p>
    </main>
  );
}

function QuizView({
  item,
  revealed,
  onReveal,
}: {
  item: QuizItem;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div className="flex w-full max-w-4xl flex-col items-center text-center">
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="mb-6 max-h-[38dvh] rounded-2xl object-contain"
        />
      )}

      <p className="text-5xl leading-tight font-bold sm:text-6xl">{item.name}</p>

      {!revealed ? (
        <>
          <p className="mt-8 text-3xl text-slate-300">업사이클링, 될까요?</p>
          <button
            type="button"
            onClick={onReveal}
            className="relative z-20 mt-8 rounded-2xl bg-brand px-12 py-5 text-2xl font-bold text-[#04262A]"
          >
            정답 보기
          </button>
        </>
      ) : (
        <div className="mt-8">
          <p
            className={`text-7xl font-bold ${
              item.possible ? "text-brand" : "text-rose-400"
            }`}
          >
            {item.possible ? "됩니다" : "안 됩니다"}
          </p>
          <p className="mt-6 max-w-3xl text-2xl leading-relaxed text-slate-200">
            {item.reason}
          </p>
        </div>
      )}
    </div>
  );
}
