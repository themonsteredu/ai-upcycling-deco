import { TrimStudio } from "@/components/teacher/TrimStudio";

export const metadata = {
  title: "재료 다듬기 — 업사이클링 키링 3D 공방",
};

/**
 * 선생님 전용 화면.
 * 노트북에서 쓰는 것을 전제로 하고, 아직 비밀번호 잠금은 걸려 있지 않다.
 * (잠금과 Supabase 저장은 다음 단계에서 붙인다)
 */
export default function TrimPage() {
  return <TrimStudio />;
}
