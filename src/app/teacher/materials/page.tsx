import Link from "next/link";
import { MaterialManager } from "@/components/teacher/MaterialManager";
import { TeacherGate } from "@/components/teacher/TeacherGate";
import { getSupabaseAdmin, type MaterialRow } from "@/lib/supabase";
import { hasTeacherPassword, isTeacher, signInTeacher } from "@/lib/teacher-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "재료함 관리 — 업사이클 키링 디자인",
};

async function signIn(password: string) {
  "use server";
  return signInTeacher(password);
}

export default async function MaterialsPage() {
  if (!hasTeacherPassword()) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16">
        <h1 className="text-xl font-bold">비밀번호가 아직 없습니다</h1>
        <p className="mt-3 leading-relaxed text-slate-600">
          선생님 화면은 비밀번호 하나로 잠급니다. Vercel 환경변수에{" "}
          <code className="rounded bg-slate-200 px-1.5 py-0.5">TEACHER_PASSWORD</code>{" "}
          를 넣고 다시 배포해 주세요.
        </p>
        <Link href="/" className="mt-6 inline-block font-bold text-brand">
          ← 처음으로
        </Link>
      </main>
    );
  }

  if (!(await isTeacher())) {
    return <TeacherGate onSubmit={signIn} />;
  }

  const supabase = getSupabaseAdmin();
  let rows: MaterialRow[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("upcycling_materials")
      .select("id, kind, name, category, image_url, base_scale, is_active, sort_order")
      .order("sort_order", { ascending: true });
    rows = (data as MaterialRow[]) ?? [];
  }

  return <MaterialManager initial={rows} ready={Boolean(supabase)} />;
}
