/**
 * 청바지 해체소에서 한 것을 그 태블릿에 담아 둔다.
 *
 * 뒤로 갔다 와도, 새로고침해도 다시 안 하게 하기 위한 것이다.
 * 고른 조각은 3D 공방과 제출 화면에서도 읽어 쓴다.
 */

export const TEARDOWN_STORAGE_KEY = "upcycling-teardown-v1";

export type TeardownState = {
  /** 뜯어낸 조각 번호들 */
  taken: string[];
  /** 내 키링을 만들 조각. 아직 안 골랐으면 null */
  chosen: string | null;
};

export const EMPTY_TEARDOWN: TeardownState = { taken: [], chosen: null };

export function readTeardown(): TeardownState {
  try {
    const raw = window.localStorage.getItem(TEARDOWN_STORAGE_KEY);
    if (!raw) return EMPTY_TEARDOWN;
    const state = JSON.parse(raw) as TeardownState;
    return {
      taken: Array.isArray(state?.taken) ? state.taken : [],
      chosen: typeof state?.chosen === "string" ? state.chosen : null,
    };
  } catch {
    return EMPTY_TEARDOWN;
  }
}

export function saveTeardown(state: TeardownState) {
  try {
    window.localStorage.setItem(TEARDOWN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 공간이 부족해도 활동은 계속되어야 한다
  }
}
