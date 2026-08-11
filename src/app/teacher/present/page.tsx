import { Present } from "@/components/teacher/Present";
import { teacherGuard } from "@/components/teacher/TeacherPage";
import { DEFAULT_QUIZ, toIntro, type Intro } from "@/lib/intro";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "수업 자료 — 업사이클 키링 디자인",
};

export default async function PresentPage() {
  const blocked = await teacherGuard("수업 자료");
  if (blocked) return blocked;

  const supabase = getSupabaseAdmin();
  let intro: Intro = { id: "", slides: [], quiz: DEFAULT_QUIZ };
  if (supabase) {
    const { data } = await supabase
      .from("upcycling_intro")
      .select("id, slides, quiz")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // 아직 아무것도 저장 안 했으면 예시 퀴즈로 바로 해 볼 수 있게 둔다
    if (data) {
      const saved = toIntro(data);
      intro = saved.quiz.length > 0 ? saved : { ...saved, quiz: DEFAULT_QUIZ };
    }
  }

  return <Present intro={intro} />;
}
