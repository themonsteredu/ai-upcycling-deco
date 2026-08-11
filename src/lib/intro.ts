/**
 * 수업 도입 자료.
 *
 * 선생님 화면(프로젝터)에서만 띄운다. 슬라이드로 업사이클링을 설명하고,
 * 「이건 업사이클링이 될까 말까」 퀴즈로 마무리한다.
 *
 * 파워포인트 파일은 브라우저에서 못 연다. 그래서 슬라이드를 사진으로
 * 내보내서 올린다 (PowerPoint → 파일 → 내보내기 → 그림으로).
 */

export type QuizItem = {
  id: string;
  /** 물건 이름 */
  name: string;
  /** 업사이클링이 되는 물건인지 */
  possible: boolean;
  /** 정답을 열었을 때 나오는 한 줄 */
  reason: string;
  /** 물건 사진. 없으면 글씨만 크게 나온다 */
  imageUrl?: string | null;
};

export type Intro = {
  id: string;
  slides: string[];
  quiz: QuizItem[];
  /** 앱에 들어 있는 카드뉴스를 쓸지. 직접 만든 PPT만 쓰고 싶으면 끈다 */
  useCards: boolean;
};

type Row = {
  id: string;
  slides: string[] | null;
  quiz: QuizItem[] | null;
  use_cards?: boolean | null;
};

export function toIntro(row: Row): Intro {
  return {
    id: row.id,
    slides: Array.isArray(row.slides) ? row.slides : [],
    quiz: Array.isArray(row.quiz) ? row.quiz : [],
    useCards: row.use_cards !== false,
  };
}

/**
 * 처음 열었을 때 들어 있는 퀴즈.
 *
 * 놀라운 것 위주로 골랐다. 「될 것 같은데 안 되는 것」과
 * 「안 될 것 같은데 되는 것」이 섞여 있어야 아이들이 걸려든다.
 * 선생님이 화면에서 고치고 지우고 더할 수 있다.
 */
export const DEFAULT_QUIZ: QuizItem[] = [
  {
    id: "jeans",
    name: "낡은 청바지",
    possible: true,
    reason: "오늘 여러분이 만들 키링이 바로 이것으로 만듭니다.",
  },
  {
    id: "banner",
    name: "길에 걸린 광고 현수막",
    possible: true,
    reason: "질기고 비에도 안 젖어서 가방으로 많이 만듭니다.",
  },
  {
    id: "receipt",
    name: "마트 영수증",
    possible: false,
    reason: "특수 약품을 발라 만든 종이라 재활용조차 안 됩니다. 그냥 버려야 해요.",
  },
  {
    id: "fire-hose",
    name: "낡은 소방 호스",
    possible: true,
    reason: "불을 끄다 낡은 호스로 벨트와 가방을 만듭니다. 아주 질깁니다.",
  },
  {
    id: "pizza-box",
    name: "기름 밴 피자 상자",
    possible: false,
    reason: "기름이 스며든 종이는 다시 못 씁니다. 깨끗한 뚜껑만 떼어 내세요.",
  },
  {
    id: "seatbelt",
    name: "자동차 안전벨트",
    possible: true,
    reason: "사고를 견디라고 만든 띠라서, 가방 끈으로 그만입니다.",
  },
  {
    id: "ice-pack",
    name: "아이스팩",
    possible: false,
    reason:
      "안에 든 젤이 물에 안 녹아서 재활용이 안 됩니다. 깨끗하면 씻어서 다시 쓰는 곳에 주세요.",
  },
  {
    id: "coffee",
    name: "카페에서 나온 커피 찌꺼기",
    possible: true,
    reason: "말려서 화분이나 방향제로 만듭니다. 하루에 수백 킬로그램씩 나옵니다.",
  },
];

/** 아직 아무것도 안 올렸을 때 쓸 빈 자료 */
export const EMPTY_INTRO: Intro = {
  id: "",
  slides: [],
  quiz: DEFAULT_QUIZ,
  useCards: true,
};
