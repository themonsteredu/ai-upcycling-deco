/** 기본으로 들어 있는 부자재 모양들 */
export type ShapeId =
  | "btnRound"
  | "btnStar"
  | "btnFlower"
  | "square"
  | "circle"
  | "triangle"
  | "heart"
  | "leaf";

export type MaterialCategory = "천 조각" | "단추" | "얼굴 부속" | "기타";

/** 재료함에 들어가는 부자재 하나 */
export type Material = {
  id: string;
  name: string;
  category: MaterialCategory;
  /** 기본 크기 배율 */
  baseScale: number;
} & (
  | {
      /** 앱에 들어 있는 3D 도형. 색을 바꿀 수 있다 */
      kind: "shape";
      shape: ShapeId;
      /** 재료함에 보여줄 그림글자 */
      emoji: string;
    }
  | {
      /** 선생님이 넣은 실물 사진. 색은 바꾸지 않는다 */
      kind: "image";
      imageUrl: string;
      /** 가로 ÷ 세로 */
      aspect: number;
    }
);

/** 기본 재료함. 사진이 하나도 없어도 수업을 시작할 수 있어야 한다. */
export const BUILTIN_MATERIALS: Material[] = [
  { id: "btn-round", kind: "shape", shape: "btnRound", name: "동그란 단추", emoji: "🔘", category: "단추", baseScale: 1 },
  { id: "btn-star", kind: "shape", shape: "btnStar", name: "별 단추", emoji: "⭐", category: "단추", baseScale: 1 },
  { id: "btn-flower", kind: "shape", shape: "btnFlower", name: "꽃 단추", emoji: "🌼", category: "단추", baseScale: 1 },
  { id: "cloth-square", kind: "shape", shape: "square", name: "네모 천", emoji: "🟦", category: "천 조각", baseScale: 1 },
  { id: "cloth-triangle", kind: "shape", shape: "triangle", name: "지붕 천", emoji: "🔺", category: "천 조각", baseScale: 1 },
  { id: "cloth-heart", kind: "shape", shape: "heart", name: "하트 천", emoji: "💗", category: "천 조각", baseScale: 1 },
  { id: "cloth-leaf", kind: "shape", shape: "leaf", name: "나뭇잎 천", emoji: "🍃", category: "천 조각", baseScale: 1 },
  { id: "cloth-circle", kind: "shape", shape: "circle", name: "동그란 천", emoji: "⚪", category: "천 조각", baseScale: 1 },
];

/** 기본 도형에 칠할 수 있는 색 */
export const DECO_COLORS = [
  "#E4534A",
  "#F2A03D",
  "#F2D64B",
  "#7FBF4F",
  "#0DBDB9",
  "#5B93D6",
  "#9B7BF0",
  "#F08CB4",
  "#F4F1E8",
  "#2B2B2B",
];

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
  /** 기본 도형일 때만 쓰는 색 */
  color?: string;
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

export const DRAFT_STORAGE_KEY = "upcycling-workshop-draft-v2";

/** 넣은 사진을 이 크기로 줄여 저장한다. 브라우저 저장 공간이 넉넉하지 않다 */
export const UPLOAD_MAX_PX = 384;
