import { teacherGuard } from "@/components/teacher/TeacherPage";
import { TrimStudio } from "@/components/teacher/TrimStudio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "재료 다듬기 — 업사이클 키링 디자인",
};

/** 선생님 전용. 노트북에서 쓰는 것을 전제로 한다 */
export default async function TrimPage() {
  const blocked = await teacherGuard("재료 다듬기");
  if (blocked) return blocked;

  return <TrimStudio />;
}
