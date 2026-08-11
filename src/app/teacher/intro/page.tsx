import { IntroManager } from "@/components/teacher/IntroManager";
import { teacherGuard } from "@/components/teacher/TeacherPage";
import { DEFAULT_QUIZ, toIntro, type Intro } from "@/lib/intro";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "수업 자료 준비 — 업사이클 키링 디자인",
};

export default async function IntroPage() {
  const blocked = await teacherGuard("수업 자료 준비");
  if (blocked) return blocked;

  const supabase = getSupabaseAdmin();
  let intro: Intro = { id: "", slides: [], quiz: DEFAULT_QUIZ, useCards: true };
  if (supabase) {
    const { data } = await supabase
      .from("upcycling_intro")
      .select("id, slides, quiz, use_cards")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const saved = toIntro(data);
      // 아직 퀴즈를 한 번도 저장 안 했으면 예시를 채워 준다
      intro = saved.quiz.length > 0 ? saved : { ...saved, quiz: DEFAULT_QUIZ };
    }
  }

  return <IntroManager initial={intro} ready={Boolean(supabase)} />;
}
