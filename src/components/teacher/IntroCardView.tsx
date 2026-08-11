"use client";

import type { IntroCard } from "@/lib/intro-cards";

/**
 * 카드뉴스 한 장.
 *
 * 한 장에 한 가지만 담는다. 교실 뒤에서도 읽히도록 글씨를 크게 쓰고,
 * 제일 중요한 낱말 하나만 브랜드 색으로 살린다.
 */
export function IntroCardView({ card }: { card: IntroCard }) {
  if (card.kind === "hook") {
    return (
      <div className="text-center">
        <p className="text-xl tracking-wide text-brand sm:text-2xl">{card.note}</p>
        <p className="mt-8 text-5xl leading-[1.25] font-bold whitespace-pre-line sm:text-7xl">
          {card.headline}
        </p>
      </div>
    );
  }

  if (card.kind === "number") {
    return (
      <div className="text-center">
        <p className="text-6xl leading-none font-bold text-brand sm:text-8xl">
          {card.big}
        </p>
        <p className="mt-8 text-3xl font-bold sm:text-4xl">{card.headline}</p>
        <p className="mx-auto mt-5 max-w-3xl text-xl leading-relaxed text-slate-300 sm:text-2xl">
          {card.body}
        </p>
      </div>
    );
  }

  if (card.kind === "compare") {
    return (
      <div className="w-full max-w-5xl">
        <p className="text-center text-2xl font-bold sm:text-3xl">
          {card.headline}
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {[card.left, card.right].map((side, index) => (
            <div
              key={side.title}
              className={`rounded-2xl p-8 ${
                index === 1
                  ? "bg-brand/15 ring-2 ring-brand"
                  : "bg-white/5 ring-1 ring-white/15"
              }`}
            >
              <p
                className={`text-4xl font-bold ${
                  index === 1 ? "text-brand" : "text-slate-200"
                }`}
              >
                {side.title}
              </p>
              <p className="mt-4 text-xl leading-relaxed text-slate-200">
                {side.body}
              </p>
              <p
                className={`mt-6 text-lg font-bold ${
                  index === 1 ? "text-white" : "text-slate-400"
                }`}
              >
                {side.tail}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (card.kind === "list") {
    return (
      <div className="w-full max-w-4xl">
        <p className="text-center text-3xl font-bold sm:text-4xl">
          {card.headline}
        </p>
        <div className="mt-10 space-y-4">
          {card.items.map(([from, to]) => (
            <div
              key={from}
              className="flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-white/5 px-6 py-5 text-center"
            >
              <span className="text-2xl text-slate-300 sm:text-3xl">{from}</span>
              <span className="text-2xl text-brand sm:text-3xl">→</span>
              <span className="text-3xl font-bold text-white sm:text-4xl">
                {to}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl text-center">
      <p className="text-4xl leading-tight font-bold sm:text-5xl">
        {card.headline}
      </p>
      <p className="mt-8 text-xl leading-relaxed text-slate-300 sm:text-2xl">
        {card.body}
      </p>
      <p className="mt-10 text-2xl font-bold text-brand sm:text-3xl">
        {card.note}
      </p>
    </div>
  );
}
