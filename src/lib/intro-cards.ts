/**
 * 수업 도입 카드뉴스.
 *
 * 앱에 내용이 들어 있어야 선생님이 빈 화면 앞에서 고민하지 않는다.
 * 사진 없이 큰 글씨와 숫자만으로 간다. 프로젝터에서 교실 뒤까지 읽히고,
 * 학교 인터넷이 느려도 바로 뜬다.
 *
 * 흐름: 질문을 던지고 → 숫자로 놀라게 하고 → 리사이클과 업사이클을
 * 갈라 주고 → 우리 수업의 숫자로 잇고 → 직업으로 연결하고 →
 * 「그런데 아무거나 되는 건 아니다」로 퀴즈에 넘긴다.
 */

export type IntroCard =
  | { kind: "hook"; note: string; headline: string }
  | { kind: "number"; big: string; headline: string; body: string }
  | {
      kind: "compare";
      headline: string;
      left: { title: string; body: string; tail: string };
      right: { title: string; body: string; tail: string };
    }
  | { kind: "list"; headline: string; items: [string, string][] }
  | { kind: "bridge"; headline: string; body: string; note: string };

export const INTRO_CARDS: IntroCard[] = [
  {
    kind: "hook",
    note: "옷장에서 사라진 다음 이야기",
    headline: "여러분이 입던 옷은\n어디로 갈까요?",
  },
  {
    kind: "number",
    big: "2,700리터",
    headline: "면 티셔츠 한 장을 만드는 데 드는 물",
    body: "한 사람이 2년 반 동안 마실 물입니다. 티셔츠 한 장에.",
  },
  {
    kind: "compare",
    headline: "버린 것을 다시 쓰는 방법은 두 가지입니다",
    left: {
      title: "리사이클",
      body: "녹이고 잘게 부숴서 원료로 되돌립니다.",
      tail: "다시 쓸수록 품질이 떨어집니다",
    },
    right: {
      title: "업사이클",
      body: "모양을 살려 더 좋은 물건으로 만듭니다.",
      tail: "다시 쓸수록 값이 올라갑니다",
    },
  },
  {
    kind: "number",
    big: "300원 → 60,000원",
    headline: "청바지 한 벌이 가는 두 갈래 길",
    body: "헌옷수거함에 넣으면 300원. 키링 열두 개로 만들면 60,000원.",
  },
  {
    kind: "list",
    headline: "이미 이렇게 만들고 있습니다",
    items: [
      ["길에 걸렸던 광고 현수막", "가방"],
      ["불을 끄다 낡은 소방 호스", "벨트"],
      ["폐차에서 떼어낸 안전벨트", "가방 끈"],
    ],
  },
  {
    kind: "bridge",
    headline: "이걸 직업으로 하는 사람들이 있습니다",
    body: "업사이클 디자이너는 버려질 물건에서 쓸 곳을 찾아냅니다. 상품기획자는 거기에 값을 매기고 파는 방법을 정합니다.",
    note: "오늘 여러분은 두 가지를 다 해 봅니다",
  },
  {
    kind: "bridge",
    headline: "그런데 아무거나 다 되는 건 아닙니다",
    body: "될 것 같은데 안 되는 것이 있고, 안 될 것 같은데 되는 것이 있습니다.",
    note: "지금부터 맞혀 보세요",
  },
];
