"use client";

import dynamic from "next/dynamic";
import type { BaseType } from "@/lib/workshop-types";

/**
 * 3D 화면은 브라우저에서만 그릴 수 있고,
 * 작업하던 내용도 브라우저 저장소에서 바로 읽어야 하므로 서버 렌더링을 끈다.
 */
const Workshop = dynamic(
  () => import("./Workshop").then((m) => m.Workshop),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh items-center justify-center text-sm text-slate-400">
        3D 공방을 여는 중…
      </div>
    ),
  },
);

export function WorkshopClient(props: { availableBases: BaseType[] }) {
  return <Workshop {...props} />;
}
