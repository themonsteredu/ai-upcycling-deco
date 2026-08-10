import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

/*
 * 사진 목록은 화면을 열 때가 아니라 앱을 만들 때 한 번만 읽는다.
 * Vercel에 올리면 서버 쪽에 public 폴더가 없어서 그때 읽으면 빈 목록이 나온다.
 * 사진을 새로 넣으면 다시 올리기만 하면 반영된다.
 */
export const dynamic = "force-static";

const BASE_FILES = [
  { file: "denim-front.png", label: "데님 앞면" },
  { file: "denim-back.png", label: "데님 뒷면" },
  { file: "linen-front.png", label: "리넨 앞면" },
  { file: "linen-back.png", label: "리넨 뒷면" },
];

function listImages(dir: string) {
  try {
    return fs
      .readdirSync(path.join(process.cwd(), "public", dir))
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
  } catch {
    return [];
  }
}

export default function Home() {
  const baseFiles = listImages("base");
  const materialFiles = listImages("materials");
  const missingBases = BASE_FILES.filter((b) => !baseFiles.includes(b.file));

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="text-sm font-semibold tracking-wide text-brand">모아킷 진로체험</p>
      <h1 className="mt-2 text-3xl font-bold">업사이클링 키링 3D 공방</h1>
      <p className="mt-3 leading-relaxed text-slate-600">
        청바지로 만든 키링에 부자재를 붙여 설계도를 만들고, 그 화면을 보면서 실제
        바느질로 완성합니다.
      </p>

      <div className="mt-8 space-y-3">
        <Link
          href="/workshop"
          className="block rounded-xl bg-brand p-5 text-white shadow-sm"
        >
          <span className="block text-lg font-bold">3D 공방 열기</span>
          <span className="mt-1 block text-sm text-white/85">
            키링을 돌려보고 부자재를 붙입니다 — 학생 화면
          </span>
        </Link>

        <Link
          href="/teacher/trim"
          className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <span className="block text-lg font-bold">재료 다듬기</span>
          <span className="mt-1 block text-sm text-slate-500">
            찍어 온 부자재 사진의 배경을 지웁니다 — 선생님 화면
          </span>
        </Link>
      </div>

      <section className="mt-10 border-t border-slate-200 pt-6 text-sm">
        <p className="font-bold">지금 들어와 있는 사진</p>
        <ul className="mt-3 space-y-1 text-slate-600">
          <li>
            키링 본체{" "}
            {missingBases.length === 0 ? (
              <b className="text-brand">4장 모두 준비됨</b>
            ) : (
              <span className="text-rose-500">
                {missingBases.map((b) => b.label).join(", ")} 없음
              </span>
            )}
          </li>
          <li>
            부자재{" "}
            {materialFiles.length > 0 ? (
              <b className="text-brand">{materialFiles.length}장</b>
            ) : (
              <span className="text-slate-400">아직 없음</span>
            )}
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          사진은 저장소의 <code>public/base</code>, <code>public/materials</code> 폴더에
          넣습니다. 넣고 다시 올리면 이 화면에 바로 반영됩니다.
        </p>
      </section>
    </main>
  );
}
