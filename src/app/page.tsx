import fs from "node:fs";
import path from "node:path";

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
  const baseReady = BASE_FILES.every((b) => baseFiles.includes(b.file));

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="text-sm font-semibold tracking-wide text-brand">
        업사이클링 키링 3D 공방
      </p>
      <h1 className="mt-2 text-2xl font-bold">1단계 준비 중 — 사진을 기다리는 중입니다</h1>
      <p className="mt-3 leading-relaxed text-slate-600">
        아래 사진을 폴더에 넣어 주시면 3D 공방 화면을 만들 수 있습니다.
        파일을 넣고 이 화면을 새로고침하면 체크 표시가 바뀝니다.
      </p>

      <section className="mt-8">
        <h2 className="font-bold">
          1. 키링 본체 사진 —{" "}
          <code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm">public/base/</code>
        </h2>
        <ul className="mt-3 space-y-2">
          {BASE_FILES.map(({ file, label }) => {
            const ok = baseFiles.includes(file);
            return (
              <li key={file} className="flex items-center gap-3 text-sm">
                <span className={ok ? "text-brand" : "text-slate-300"}>
                  {ok ? "✅" : "⬜"}
                </span>
                <code className={ok ? "font-semibold" : "text-slate-500"}>{file}</code>
                <span className="text-slate-500">{label}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-slate-500">
          배경이 지워진 투명 PNG, 가로 : 세로 = 2.7 : 2.1 (권장 1350 × 1050 픽셀).
          자세한 내용은 <code>public/base/README.md</code> 파일에 적어 두었습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-bold">
          2. 부자재 사진 —{" "}
          <code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm">public/materials/</code>
        </h2>
        <p className="mt-3 text-sm">
          {materialFiles.length === 0 ? (
            <span className="text-slate-500">
              ⬜ 아직 없습니다. 5~10장 정도 넣어 주세요.
            </span>
          ) : (
            <span className="font-semibold text-brand">
              ✅ {materialFiles.length}장 들어와 있습니다 — {materialFiles.join(", ")}
            </span>
          )}
        </p>
      </section>

      {baseReady && (
        <p className="mt-8 rounded-lg bg-brand-light p-4 text-sm font-semibold text-brand-dark">
          본체 사진이 모두 준비됐습니다. 이제 3D 공방 화면을 만들 수 있습니다.
        </p>
      )}
    </main>
  );
}
