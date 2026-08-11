"use client";

import { DENIM_PARTS } from "@/lib/denim-parts";

/*
 * 청바지 그림.
 *
 * 사진을 쓰지 않는 이유가 있다. 사진은 청바지를 바꿀 때마다 누를 자리를
 * 다시 잡아야 하고, 학교 인터넷이 느리면 늦게 뜬다. 그림은 어느 크기에서도
 * 또렷하고 바로 뜬다.
 *
 * 그림에는 글씨를 넣지 않는다. 조각이 작아서 이름표가 서로 겹치고,
 * 무엇보다 이름이 다 보이면 「찾는 재미」가 없어진다.
 * 이름은 옆의 조각 목록에서 찾은 것부터 하나씩 드러난다.
 *
 * 좌표계는 240 x 460. 조각 위치는 denim-parts.ts 에 함께 적어 둔다.
 */

const BODY =
  "M 40 34 L 200 34 L 196 150 L 178 424 L 132 424 L 120 214 L 108 424 L 62 424 L 44 150 Z";

type Props = {
  /** 이미 뜯어낸 조각 */
  taken: string[];
  /** 크게 깜빡여 알려줄 조각 (「모르겠어요」를 눌렀을 때) */
  hint: string | null;
  onPick: (id: string) => void;
};

export function JeansSvg({ taken, hint, onPick }: Props) {
  return (
    <svg
      viewBox="0 0 240 460"
      className="h-full w-full touch-none select-none"
      role="img"
      aria-label="청바지 한 벌"
    >
      <defs>
        <linearGradient id="denim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#43607F" />
          <stop offset="55%" stopColor="#3A5372" />
          <stop offset="100%" stopColor="#2F4661" />
        </linearGradient>
      </defs>

      <path d={BODY} fill="url(#denim)" />

      {/* 바깥 솔기 */}
      <path
        d="M 47 66 L 66 418 M 193 66 L 174 418"
        stroke="#D9B26A"
        strokeWidth={1.6}
        strokeDasharray="7 5"
        fill="none"
        opacity={0.6}
      />

      {DENIM_PARTS.map((part) => {
        const gone = taken.includes(part.id);
        return (
          <g
            key={part.id}
            onPointerDown={(event) => {
              event.preventDefault();
              if (!gone) onPick(part.id);
            }}
            className={gone ? undefined : "cursor-pointer"}
          >
            {/* 손가락으로 누를 자리를 넉넉히 잡는다 (작은 조각도 잘 잡히게) */}
            {!gone && (
              <path
                d={part.shape}
                fill="transparent"
                stroke="transparent"
                strokeWidth={14}
              />
            )}
            <path
              d={part.shape}
              fill={gone ? "#24384D" : "#2A4058"}
              fillOpacity={gone ? 0.45 : 0.85}
              stroke={gone ? "none" : "#F0C674"}
              strokeWidth={2}
              strokeDasharray={gone ? undefined : "6 4"}
              className={
                gone
                  ? undefined
                  : hint === part.id
                    ? "jeans-part-hint"
                    : "jeans-part"
              }
              pointerEvents="none"
            />
          </g>
        );
      })}
    </svg>
  );
}
