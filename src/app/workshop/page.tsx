import { WorkshopClient } from "@/components/workshop/WorkshopClient";
import { AVAILABLE_BASES } from "@/lib/workshop-types";

/**
 * 수업 없이 혼자 연습해 보는 3D 공방.
 * 수업 중에는 `/c/[수업코드]/workshop` 으로 들어간다.
 */
export const dynamic = "force-static";

export const metadata = {
  title: "3D 공방 — 업사이클 키링 디자인",
};

export default function WorkshopPage() {
  return <WorkshopClient availableBases={AVAILABLE_BASES} />;
}
