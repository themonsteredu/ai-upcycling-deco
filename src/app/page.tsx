import Link from "next/link";

export const dynamic = "force-static";

/**
 * 학생이 처음 보는 화면.
 *
 * 청바지에서 시작하는 수업이라 화면도 데님에서 가져왔다.
 * 짙은 인디고 바탕에 금색 박음질선 한 줄, 브랜드 청록은 눌러야 할 곳에만.
 *
 * 그림은 한 장도 안 쓴다. 바탕의 결은 데님 능직(사선)을 옅은 사선 줄무늬로
 * 흉내 낸 것이라 파일을 안 받아도 되고, 학교 인터넷이 느려도 바로 뜬다.
 */

/** 진짜 청바지 박음질에 쓰는 금색 실 */
const THREAD = "#D9A441";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0E1A2B] text-white">
      {/* 데님 능직 결 — 45도 옅은 사선 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 4px)",
        }}
      />
      {/* 위쪽에 스며드는 빛. 평평한 색만 있으면 인쇄물처럼 납작해 보인다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(75% 45% at 88% -5%, rgba(13,189,185,0.16), transparent 65%), radial-gradient(100% 55% at 10% 105%, rgba(4,10,20,0.55), transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-7 py-10 sm:px-10 sm:py-14">
        {/* ── 머리 ── */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tracking-wide text-brand">
            모아킷 진로체험
          </span>
          <span
            aria-hidden
            className="h-px flex-1"
            style={{ backgroundImage: `linear-gradient(90deg, ${THREAD}66, transparent)` }}
          />
        </div>

        {/*
          제목부터 시작 단추까지를 한 덩어리로 묶어 가운데에 둔다.
          제목은 위, 단추는 화면 맨 아래로 떨어뜨려 놓으면 태블릿 세로에서
          가운데가 텅 비어 허전해 보인다.
        */}
        <div className="flex flex-1 flex-col justify-center py-10">
          <p className="text-base font-light text-slate-400 tall:text-lg">
            버려질 청바지 한 벌에서
          </p>
          {/* 태블릿에서는 글씨를 크게 키운다. 크기를 안 키우면 화면만 넓어져 허전하다 */}
          <h1 className="mt-3 text-[2.6rem] leading-[1.15] font-bold tracking-tight tall:mt-4 tall:text-7xl">
            업사이클 키링
            <br />
            <span className="text-brand">디자인</span>
          </h1>

          {/* 박음질선 — 청바지 옆선을 따라가는 두 줄 */}
          <div aria-hidden className="mt-9 space-y-1 tall:mt-12">
            <div
              className="h-0 border-t border-dashed"
              style={{ borderColor: `${THREAD}99` }}
            />
            <div
              className="h-0 border-t border-dashed"
              style={{ borderColor: `${THREAD}55` }}
            />
          </div>

          <p className="mt-9 text-lg leading-relaxed font-light text-slate-300 tall:mt-12 tall:text-xl">
            화면에서 키링을 3D로 설계하고, 그 설계도를 보면서 실제 바느질로
            완성합니다.
          </p>

          {/* ── 시작 ── */}
          <Link
            href="/workshop"
            className="mt-12 block rounded-2xl bg-brand px-6 py-6 text-center text-xl font-bold text-[#06282A] shadow-[0_10px_30px_-10px_rgba(13,189,185,0.6)] tall:mt-16 tall:py-7 tall:text-2xl"
          >
            3D 공방 시작하기
          </Link>
          <p className="mt-4 text-center text-sm font-light text-slate-400 tall:mt-5 tall:text-base">
            재료를 고르고 키링 위를 눌러 붙여 보세요
          </p>
        </div>

        {/*
          오늘 무엇을 하는지 세 걸음으로. 아래쪽을 채우기도 하지만,
          「눌렀더니 갑자기 3D가 나왔다」가 되지 않게 미리 알려 주는 몫이 크다.
        */}
        <ul className="grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-5 tall:py-7">
          {[
            ["01", "재료 고르기"],
            ["02", "붙여 꾸미기"],
            ["03", "실제 바느질"],
          ].map(([number, label]) => (
            <li key={number} className="px-2 text-center">
              <span
                className="block text-xs font-bold"
                style={{ color: THREAD }}
              >
                {number}
              </span>
              <span className="mt-1.5 block text-sm font-light text-slate-300 tall:text-base">
                {label}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex justify-center">
          <Link
            href="/teacher"
            className="text-xs font-light text-slate-500 underline underline-offset-4"
          >
            선생님 화면
          </Link>
        </div>
      </div>
    </main>
  );
}
