import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { WorkshopClient } from "@/components/workshop/WorkshopClient";
import type { BaseType, Material, MaterialCategory } from "@/lib/workshop-types";

/*
 * 사진 목록은 화면을 열 때가 아니라 앱을 만들 때 한 번만 읽는다.
 * Vercel에 올리면 서버 쪽에 public 폴더가 없어서 그때 읽으면 빈 목록이 나온다.
 * 사진을 새로 넣으면 다시 올리기만 하면 반영된다.
 */
export const dynamic = "force-static";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const IMAGE_PATTERN = /\.(png|jpg|jpeg|webp)$/i;

function readImageDir(dir: string) {
  try {
    return fs.readdirSync(path.join(PUBLIC_DIR, dir)).filter((f) => IMAGE_PATTERN.test(f));
  } catch {
    return [];
  }
}

/** 파일 이름으로 분류를 추측한다. 나중에 선생님이 직접 고르게 바뀐다. */
function guessCategory(fileName: string): MaterialCategory {
  if (/scrap|fabric|cloth|denim/i.test(fileName)) return "천 조각";
  if (/button/i.test(fileName)) return "단추";
  if (/eye|mouth|nose|face|cheek/i.test(fileName)) return "얼굴 부속";
  return "기타";
}

export default function WorkshopPage() {
  const baseFiles = readImageDir("base");
  const availableBases = (["denim", "linen"] as BaseType[]).filter(
    (type) =>
      baseFiles.includes(`${type}-front.png`) && baseFiles.includes(`${type}-back.png`),
  );

  const materials: Material[] = readImageDir("materials")
    .sort()
    .map((file) => ({
      id: `folder-${file}`,
      name: file.replace(IMAGE_PATTERN, "").replace(/[-_]/g, " "),
      imageUrl: `/materials/${file}`,
      baseScale: 1,
      category: guessCategory(file),
    }));

  if (availableBases.length === 0) {
    return (
      <main className="mx-auto w-full max-w-lg px-6 py-16">
        <h1 className="text-xl font-bold">키링 본체 사진이 아직 없습니다</h1>
        <p className="mt-3 leading-relaxed text-slate-600">
          <code className="rounded bg-slate-200 px-1.5 py-0.5">public/base/</code> 폴더에
          앞면·뒷면 사진을 한 쌍 넣어 주세요. 예를 들어 데님이라면{" "}
          <code>denim-front.png</code> 와 <code>denim-back.png</code> 두 장이 모두 있어야
          합니다.
        </p>
        <Link href="/" className="mt-6 inline-block font-bold text-brand">
          ← 준비 현황 보기
        </Link>
      </main>
    );
  }

  return <WorkshopClient materials={materials} availableBases={availableBases} />;
}
