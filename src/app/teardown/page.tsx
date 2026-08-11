import { TeardownClient } from "@/components/play/TeardownClient";

export const dynamic = "force-static";

export const metadata = {
  title: "청바지 해체소 — 업사이클 키링 디자인",
};

/** 수업 없이 혼자 해 보는 해체소. 수업 중에는 /c/[수업코드]/teardown 으로 들어간다 */
export default function TeardownPage() {
  return <TeardownClient next="/workshop" />;
}
