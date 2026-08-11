import { MaterialManager } from "@/components/teacher/MaterialManager";
import { teacherGuard } from "@/components/teacher/TeacherPage";
import { getSupabaseAdmin, type MaterialRow } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "재료함 관리 — 업사이클 키링 디자인",
};

export default async function MaterialsPage() {
  const blocked = await teacherGuard("재료함 관리");
  if (blocked) return blocked;

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
