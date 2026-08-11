import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "선생님 화면 — 업사이클 키링 디자인",
};

const SCREENS = [
  {
    href: "/teacher/materials",
    name: "재료함 관리",
    note: "부자재와 고리를 올리고, 보임·숨김과 순서를 정합니다. 여기 올린 것이 모든 학생 화면에 그대로 나옵니다.",
  },
  {
    href: "/teacher/trim",
    name: "재료 다듬기",
    note: "찍어 온 사진의 배경을 지우고 잘라냅니다. 여러 개가 한 장에 찍혔으면 칸 수대로 나눠서 한 번에 만듭니다.",
  },
  {
    href: "/teacher/setup",
    name: "연결 점검",
    note: "재료함이 서버와 잘 이어져 있는지 봅니다. 수업 전에 한 번 확인하세요.",
  },
];

/** 선생님이 쓰는 화면 목록. 주소를 외울 필요가 없게 한 곳에 모은다 */
export default function TeacherHome() {
  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <p className="text-sm font-medium text-brand">모아킷 진로체험</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">선생님 화면</h1>
      <p className="mt-2 leading-relaxed font-light text-slate-500">
        수업 전에 재료를 준비하고, 수업 중에 진행을 넘기는 곳입니다.
      </p>

      <div className="mt-8 space-y-3">
        {SCREENS.map((screen) => (
          <Link
            key={screen.href}
            href={screen.href}
            className="block rounded-xl border border-slate-200 bg-white p-5"
          >
            <span className="block font-bold text-brand-dark">{screen.name}</span>
            <span className="mt-1 block text-sm leading-relaxed text-slate-500">
              {screen.note}
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/"
        className="mt-8 inline-block text-sm font-light text-slate-400 underline underline-offset-4"
      >
        ← 학생 화면으로
      </Link>
    </main>
  );
}
