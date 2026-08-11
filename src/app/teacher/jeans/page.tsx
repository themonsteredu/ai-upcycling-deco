import { JeansSetup } from "@/components/teacher/JeansSetup";
import { teacherGuard } from "@/components/teacher/TeacherPage";
import { toJeansPhoto, type JeansPhoto } from "@/lib/jeans-photo";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "청바지 사진 준비 — 업사이클 키링 디자인",
};

export default async function JeansPage() {
  const blocked = await teacherGuard("청바지 사진 준비");
  if (blocked) return blocked;

  const supabase = getSupabaseAdmin();
  let jeans: JeansPhoto | null = null;
  if (supabase) {
    const { data } = await supabase
      .from("upcycling_jeans")
      .select("id, front_url, back_url, zones")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) jeans = toJeansPhoto(data);
  }

  return <JeansSetup initial={jeans} ready={Boolean(supabase)} />;
}
