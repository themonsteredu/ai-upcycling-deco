"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchJeansPhoto,
  readJeansCache,
  saveJeansCache,
  type JeansPhoto,
} from "@/lib/jeans-photo";
import {
  EMPTY_TEARDOWN,
  readTeardown,
  saveTeardown,
  type TeardownState,
} from "@/lib/teardown-storage";
import { Teardown } from "./Teardown";

/**
 * 해체소를 브라우저 저장소와 선생님 사진에 이어 붙인 것.
 * 수업 안에서 열든 혼자 열든 똑같이 동작한다.
 */
export function TeardownBoard({ next }: { next: string }) {
  // 브라우저에만 있는 값이라 처음 그릴 때 한 번만 읽는다
  const [state, setState] = useState<TeardownState>(() =>
    typeof window === "undefined" ? EMPTY_TEARDOWN : readTeardown(),
  );
  // 인터넷이 끊겨도 지난번 사진이 나오게 담아 둔 것부터 쓴다
  const [photo, setPhoto] = useState<JeansPhoto | null>(() =>
    typeof window === "undefined" ? null : readJeansCache(),
  );
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    fetchJeansPhoto().then((fresh) => {
      if (!alive || !fresh) return;
      setPhoto(fresh);
      saveJeansCache(fresh);
    });
    return () => {
      alive = false;
    };
  }, []);

  const change = useCallback((nextState: TeardownState) => {
    setState(nextState);
    saveTeardown(nextState);
  }, []);

  return (
    <Teardown
      taken={state.taken}
      chosen={state.chosen}
      photo={photo}
      onChange={change}
      onDone={() => router.push(next)}
    />
  );
}
