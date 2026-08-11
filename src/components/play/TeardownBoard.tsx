"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMPTY_TEARDOWN,
  readTeardown,
  saveTeardown,
  type TeardownState,
} from "@/lib/teardown-storage";
import { Teardown } from "./Teardown";

/**
 * 해체소를 브라우저 저장소에 이어 붙인 것.
 * 수업 안에서 열든 혼자 열든 똑같이 동작한다.
 */
export function TeardownBoard({ next }: { next: string }) {
  // 브라우저에만 있는 값이라 처음 그릴 때 한 번만 읽는다
  const [state, setState] = useState<TeardownState>(() =>
    typeof window === "undefined" ? EMPTY_TEARDOWN : readTeardown(),
  );
  const router = useRouter();

  const change = useCallback((nextState: TeardownState) => {
    setState(nextState);
    saveTeardown(nextState);
  }, []);

  return (
    <Teardown
      taken={state.taken}
      chosen={state.chosen}
      onChange={change}
      onDone={() => router.push(next)}
    />
  );
}
