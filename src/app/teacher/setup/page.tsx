import Link from "next/link";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { hasTeacherPassword } from "@/lib/teacher-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "연결 점검 — 업사이클 키링 디자인",
};

/**
 * 연결 점검 화면.
 *
 * 비밀번호 없이 열 수 있다. 대신 열쇠 값은 절대 보여주지 않고
 * "됐다 / 안 됐다"와 다음에 뭘 눌러야 하는지만 알려준다.
 */

type Check = {
  label: string;
  ok: boolean;
  /** 안 됐을 때 뭘 해야 하는지 */
  fix: string;
};

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [
    {
      label: "선생님 비밀번호",
      ok: hasTeacherPassword(),
      fix: "Vercel 환경변수에 TEACHER_PASSWORD 를 넣어 주세요.",
    },
    {
      label: "Supabase 주소",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      fix: "Vercel 환경변수에 NEXT_PUBLIC_SUPABASE_URL 을 넣어 주세요.",
    },
    {
      label: "학생용 열쇠",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      fix: "Vercel 환경변수에 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 넣어 주세요.",
    },
    {
      label: "선생님용 열쇠",
      ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      fix: "Vercel 환경변수에 SUPABASE_SERVICE_ROLE_KEY 를 넣어 주세요.",
    },
  ];

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    checks.push(
      {
        label: "재료함 표 읽기",
        ok: false,
        fix: "위 열쇠부터 넣어 주세요.",
      },
      {
        label: "사진 저장소",
        ok: false,
        fix: "위 열쇠부터 넣어 주세요.",
      },
    );
    return checks;
  }

  const { error: tableError } = await supabase
    .from("upcycling_materials")
    .select("id")
    .limit(1);
  checks.push({
    label: "재료함 표 읽기",
    ok: !tableError,
    fix:
      tableError?.message ??
      "Supabase에서 upcycling_materials 표를 만들었는지 확인해 주세요.",
  });

  const { error: bucketError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list("", { limit: 1 });
  checks.push({
    label: "사진 저장소",
    ok: !bucketError,
    fix:
      bucketError?.message ??
      `Supabase Storage에 ${STORAGE_BUCKET} 라는 공개 버킷을 만들어 주세요.`,
  });

  return checks;
}

export default async function SetupPage() {
  const checks = await runChecks();
  const allGood = checks.every((check) => check.ok);

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <p className="text-sm font-medium text-brand">선생님 화면</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">연결 점검</h1>
      <p className="mt-2 text-sm leading-relaxed font-light text-slate-500">
        지금 이 사이트가 재료함과 잘 이어져 있는지 봅니다. 비밀 값은 여기에
        나오지 않습니다.
      </p>

      <ul className="mt-6 space-y-2">
        {checks.map((check) => (
          <li
            key={check.label}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                  check.ok ? "bg-brand" : "bg-rose-400"
                }`}
              >
                {check.ok ? "O" : "X"}
              </span>
              <span className="font-bold">{check.label}</span>
              <span className="ml-auto text-sm font-light text-slate-400">
                {check.ok ? "됐어요" : "아직이에요"}
              </span>
            </div>
            {!check.ok && (
              <p className="mt-2 pl-9 text-sm leading-relaxed text-slate-500">
                {check.fix}
              </p>
            )}
          </li>
        ))}
      </ul>

      {allGood ? (
        <div className="mt-6 rounded-xl bg-brand-light p-4">
          <p className="leading-relaxed font-bold text-brand-dark">
            모두 연결됐습니다. 이제 재료를 올릴 수 있어요.
          </p>
          <Link
            href="/teacher/materials"
            className="mt-3 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white"
          >
            재료함 관리로 가기
          </Link>
        </div>
      ) : (
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
          값을 넣은 뒤에는 Vercel에서 <b>Deployments</b> 탭 → 맨 위 줄의{" "}
          <b>⋯</b> → <b>Redeploy</b> 를 한 번 눌러 주세요. 새로 만들어야 값이
          들어갑니다.
        </p>
      )}

      <Link
        href="/"
        className="mt-8 inline-block text-sm font-light text-slate-400 underline underline-offset-4"
      >
        ← 처음으로
      </Link>
    </main>
  );
}
