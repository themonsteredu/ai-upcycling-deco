import { getSupabase } from "./supabase";

/**
 * 청바지 해체소에 쓰는 실제 청바지 사진.
 *
 * 선생님이 수업에 가져갈 진짜 청바지를 앞뒤로 찍어 올리고, 사진 위에서
 * 「여기가 뒷주머니」 처럼 여덟 군데를 톡톡 찍어 지정한다.
 * 아무것도 안 올렸으면 앱이 그린 청바지 그림으로 대신한다.
 */

export type JeansSide = "front" | "back";

/** 사진 위에서 누를 수 있는 동그란 자리. 값은 모두 사진 가로폭 대비 비율 */
export type JeansZone = {
  partId: string;
  side: JeansSide;
  /** 가운데 위치 (0~1) */
  x: number;
  y: number;
  /** 반지름 (0~1, 가로폭 기준) */
  r: number;
};

export type JeansPhoto = {
  id: string;
  frontUrl: string;
  backUrl: string | null;
  zones: JeansZone[];
};

type Row = {
  id: string;
  front_url: string;
  back_url: string | null;
  zones: JeansZone[] | null;
};

export function toJeansPhoto(row: Row): JeansPhoto {
  return {
    id: row.id,
    frontUrl: row.front_url,
    backUrl: row.back_url,
    zones: Array.isArray(row.zones) ? row.zones : [],
  };
}

/** 가장 최근에 올린 청바지 한 벌을 읽는다. 없으면 null */
export async function fetchJeansPhoto(): Promise<JeansPhoto | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("upcycling_jeans")
    .select("id, front_url, back_url, zones")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return toJeansPhoto(data as Row);
}

/** 인터넷이 끊겨도 지난번 사진이 나오게 담아 둔다 */
export const JEANS_CACHE_KEY = "upcycling-jeans-cache-v1";

export function readJeansCache(): JeansPhoto | null {
  try {
    const raw = window.localStorage.getItem(JEANS_CACHE_KEY);
    if (!raw) return null;
    const photo = JSON.parse(raw) as JeansPhoto;
    return photo?.frontUrl ? photo : null;
  } catch {
    return null;
  }
}

export function saveJeansCache(photo: JeansPhoto) {
  try {
    window.localStorage.setItem(JEANS_CACHE_KEY, JSON.stringify(photo));
  } catch {
    // 저장 공간이 부족해도 이번 수업은 그대로 돌아간다
  }
}
