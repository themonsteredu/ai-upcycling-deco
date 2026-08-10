import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 연결.
 *
 * 이 앱은 로그인이 없다. 그래서 두 가지 열쇠를 나눠 쓴다.
 * - 학생 브라우저: 공개 열쇠(anon). 읽기와 작품 제출만 할 수 있다.
 * - 선생님 작업(서버): 관리 열쇠(service role). 재료를 올리고 고치는 데 쓴다.
 *   이 열쇠는 절대 브라우저로 내보내지 않는다.
 *
 * 환경변수가 없으면 null을 돌려준다. 그러면 앱은 저장소 폴더의 사진만 쓰며
 * 평소처럼 동작한다. 수업 도중 연결이 끊겨도 3D 공방은 멈추지 않는다.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | null | undefined;

/** 학생 브라우저에서 쓰는 연결. 준비가 안 됐으면 null */
export function getSupabase(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  browserClient =
    url && anonKey
      ? createClient(url, anonKey, { auth: { persistSession: false } })
      : null;
  return browserClient;
}

/** 연결이 준비되었는지 */
export const isSupabaseReady = Boolean(url && anonKey);

/**
 * 서버에서만 쓰는 관리자 연결.
 * 브라우저에서 부르면 안 된다.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** 재료 사진을 담는 저장 공간 이름 */
export const STORAGE_BUCKET = "upcycling";

/** upcycling_materials 표의 한 줄 */
export type MaterialRow = {
  id: string;
  kind: "deco" | "hook";
  name: string;
  category: string;
  image_url: string;
  base_scale: number;
  is_active: boolean;
  sort_order: number;
};
