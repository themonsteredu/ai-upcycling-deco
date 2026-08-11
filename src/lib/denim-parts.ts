/**
 * 청바지 해체소에서 뜯어내는 조각들.
 *
 * 수업 첫 활동이다. 학생이 청바지를 조각내면서 "버리는 옷이 아니라
 * 쓸 데가 많은 재료"라는 것을 손으로 알아가게 한다.
 *
 * 개수와 설명은 선생님이 실제로 만들어 본 값으로 고치면 된다.
 * 화면을 따로 만들 만큼 자주 바뀌는 내용이 아니라 여기 상수로 둔다.
 */

export type DenimPart = {
  id: string;
  /** 조각 이름 */
  name: string;
  /** 청바지 한 벌에서 몇 개 나오는지 */
  count: number;
  /** 이걸로 뭘 만들 수 있는지 */
  becomes: string;
  /** 왜 그 쓰임에 좋은지 (한 줄) */
  why: string;
  /** 이 조각에서 나오는 키링 개수 */
  keyrings: number;
  /** 그림에서 이 조각의 자리 (JeansSvg 안의 좌표계) */
  shape: string;
};

export const DENIM_PARTS: DenimPart[] = [
  {
    id: "waistband",
    name: "허리밴드",
    count: 1,
    becomes: "팔찌·손목 끈",
    why: "빳빳해서 모양이 그대로 살아 있습니다",
    keyrings: 2,
    shape: "M 40 34 L 200 34 L 200 60 L 40 60 Z",
  },
  {
    id: "front-pocket",
    name: "앞주머니",
    count: 2,
    becomes: "작은 파우치",
    why: "안감이 있어 속이 부드럽습니다",
    keyrings: 0,
    shape: "M 44 64 L 94 64 L 88 108 Z",
  },
  {
    id: "back-pocket",
    name: "뒷주머니",
    count: 2,
    becomes: "키링 몸통",
    why: "두 겹으로 박음질돼 있어 제일 튼튼합니다",
    keyrings: 4,
    shape: "M 140 80 L 190 80 L 186 124 L 165 136 L 144 124 Z",
  },
  {
    id: "hem",
    name: "밑단",
    count: 2,
    becomes: "키링 끈",
    why: "접어 박은 자리라 잘라도 잘 풀리지 않습니다",
    keyrings: 4,
    shape: "M 62 400 L 108 400 L 108 424 L 62 424 Z M 132 400 L 178 400 L 178 424 L 132 424 Z",
  },
  {
    id: "belt-loop",
    name: "벨트고리",
    count: 5,
    becomes: "고리 다는 곳",
    why: "이미 고리 모양이라 그대로 씁니다",
    keyrings: 2,
    shape: "M 52 30 L 64 30 L 64 64 L 52 64 Z M 176 30 L 188 30 L 188 64 L 176 64 Z",
  },
  {
    id: "zipper",
    name: "지퍼",
    count: 1,
    becomes: "장식",
    why: "금속 이빨이 반짝여서 포인트가 됩니다",
    keyrings: 0,
    shape: "M 114 64 L 126 64 L 126 118 L 114 118 Z",
  },
  {
    id: "label",
    name: "브랜드 라벨",
    count: 1,
    becomes: "장식",
    why: "청바지마다 달라서 하나뿐인 조각입니다",
    keyrings: 0,
    shape: "M 130 38 L 168 38 L 168 58 L 130 58 Z",
  },
  {
    id: "rivet",
    name: "리벳",
    count: 6,
    becomes: "장식",
    why: "구리라 녹슬지 않고 오래갑니다",
    keyrings: 0,
    shape: "M 100 70 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0 M 86 118 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0",
  },
];

/** 청바지 한 벌에서 나오는 키링 개수 */
export const KEYRINGS_PER_JEANS = DENIM_PARTS.reduce(
  (sum, part) => sum + part.keyrings,
  0,
);

/** 헌옷수거함에 넣었을 때 받는 값 (원) */
export const THROWN_AWAY_PRICE = 300;
/** 키링 하나에 매겨지는 값 (원). 선생님이 실제 판매가로 고치면 된다 */
export const KEYRING_PRICE = 2000;

export function partById(id: string) {
  return DENIM_PARTS.find((part) => part.id === id) ?? null;
}
