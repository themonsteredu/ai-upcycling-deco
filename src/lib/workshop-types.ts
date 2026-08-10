/** 재료함에 들어가는 부자재 하나 */
export type Material = {
  id: string;
  name: string;
  imageUrl: string;
  /** 기본 크기 배율 */
  baseScale: number;
  category: "천 조각" | "단추" | "얼굴 부속" | "기타";
};

/** 키링 본체 종류 */
export type BaseType = "denim" | "linen";

export const BASE_LABEL: Record<BaseType, string> = {
  denim: "데님",
  linen: "리넨",
};

/**
 * 부자재 하나가 키링 표면에 붙은 상태.
 * 갤러리에서 3D로 되살리려면 이 값만 있으면 된다.
 */
export type Placement = {
  id: string;
  materialId: string;
  /** 키링 표면 위의 위치 */
  position: [number, number, number];
  /** 표면에 눕힌 방향 (기울기까지 반영된 최종 회전값) */
  quaternion: [number, number, number, number];
  /** 표면에 붙은 채로 돌린 각도 (라디안). 편집용으로 따로 들고 있는다 */
  roll: number;
  /** 기본 크기 대비 배율 */
  size: number;
};

/** 학생이 작업하던 내용 (뒤로 갔다 와도 살아남아야 한다) */
export type WorkshopDraft = {
  baseType: BaseType;
  placements: Placement[];
};

export const SIZE_MIN = 0.4;
export const SIZE_MAX = 2.0;
/** 크기 배율 1일 때 부자재의 긴 변 길이 (키링 가로가 2.7) */
export const STICKER_UNIT = 0.5;
/** 표면에서 살짝 띄워 z-fighting을 막는다 */
export const STICKER_LIFT = 0.006;

export const DRAFT_STORAGE_KEY = "upcycling-workshop-draft-v1";
