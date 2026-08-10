import Link from "next/link";

export const dynamic = "force-static";

/** 학생이 처음 보는 화면. 필요한 것 하나만 크게 둔다. */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium tracking-wide text-brand">모아킷 진로체험</p>
      <h1 className="mt-2 text-[2rem] leading-tight font-bold tracking-tight">
        업사이클 키링
        <br />
        디자인
      </h1>
      <p className="mt-4 leading-relaxed font-light text-slate-600">
        버려진 청바지로 만든 키링에 부자재를 붙여 설계도를 만들고,
        <br />그 화면을 보면서 실제 바느질로 완성합니다.
      </p>

      <Link
        href="/workshop"
        className="mt-10 block rounded-2xl bg-brand px-6 py-6 text-center text-xl font-bold text-white shadow-sm"
      >
        3D 공방 시작하기
      </Link>

      <p className="mt-4 text-center text-sm font-light text-slate-500">
        재료를 고르고 키링 위를 눌러 붙여 보세요
      </p>

      <div className="mt-auto pt-14 text-center">
        <Link
          href="/teacher/trim"
          className="text-xs font-light text-slate-400 underline underline-offset-4"
        >
          선생님용 — 재료 다듬기
        </Link>
      </div>
    </main>
  );
}
