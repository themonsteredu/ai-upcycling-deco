export type MaterialCategory = "천 조각" | "단추" | "얼굴 부속" | "기타";

/**
 * 재료함에 들어가는 부자재 하나.
 * 실물 사진만 쓴다. 실물이므로 색은 바꾸지 않는다.
 */
export type Material = {
  id: string;
  name: string;
  category: MaterialCategory;
  /** 기본 크기 배율 */
  baseScale: number;
  imageUrl: string;
  /** 가로 ÷ 세로. 모르면 브라우저가 사진을 읽어 알아낸다 */
  aspect?: number;
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
  /** 선생님이 넣은 사진 재료. 새로고침해도 남아야 한다 */
  addedMaterials: Material[];
};

export const SIZE_MIN = 0.45;
export const SIZE_MAX = 2.0;
/** 크기 배율 1일 때 부자재의 긴 변 길이 (키링 세로가 2.1) */
export const DECO_UNIT = 0.62;
/** 표면에서 살짝 띄워 겹쳐 깜빡이는 것을 막는다 */
export const DECO_LIFT = 0.008;

export const DRAFT_STORAGE_KEY = "upcycling-workshop-draft-v3";

/** 넣은 사진을 이 크기로 줄여 저장한다. 브라우저 저장 공간이 넉넉하지 않다 */
export const UPLOAD_MAX_PX = 384;
