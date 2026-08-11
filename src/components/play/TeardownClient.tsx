"use client";

import dynamic from "next/dynamic";

/**
 * 해체소는 그 태블릿의 저장소를 바로 읽어야 하므로 서버 렌더링을 끈다.
 * (서버에서 그리면 "아직 아무것도 안 뜯음"으로 그려졌다가 바뀌어 깜빡인다)
 */
const TeardownBoard = dynamic(
  () => import("./TeardownBoard").then((m) => m.TeardownBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh items-center justify-center text-sm text-slate-400">
        청바지를 가져오는 중…
      </div>
    ),
  },
);

export function TeardownClient({ next }: { next: string }) {
  return <TeardownBoard next={next} />;
}
