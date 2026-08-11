"use client";

import { useState } from "react";
import type { JeansPhoto, JeansSide } from "@/lib/jeans-photo";

/**
 * 실제 청바지 사진 위에서 조각을 찾는 화면.
 *
 * 선생님이 찍어 둔 자리에만 동그라미가 뜬다. 자리를 안 찍은 조각은
 * 아예 안 나오므로, 학생이 못 찾고 헤매는 일이 없다.
 */

type Props = {
  photo: JeansPhoto;
  taken: string[];
  /** 크게 깜빡여 알려줄 조각 */
  hint: string | null;
  onPick: (id: string) => void;
};

export function JeansPhotoStage({ photo, taken, hint, onPick }: Props) {
  const [side, setSide] = useState<JeansSide>("front");
  const url = side === "front" ? photo.frontUrl : photo.backUrl;
  const hasBack = Boolean(photo.backUrl);

  return (
    <div>
      {hasBack && (
        <div className="mb-2 flex justify-center gap-2">
          {(["front", "back"] as JeansSide[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSide(value)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                side === value
                  ? "bg-brand text-white"
                  : "bg-white text-slate-500"
              }`}
            >
              {value === "front" ? "앞면" : "뒷면"}
            </button>
          ))}
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url ?? photo.frontUrl} alt="청바지" className="w-full" draggable={false} />

        {photo.zones
          .filter((zone) => zone.side === side)
          .map((zone) => {
            const gone = taken.includes(zone.partId);
            return (
              <button
                key={`${zone.partId}-${zone.side}`}
                type="button"
                onClick={() => {
                  if (!gone) onPick(zone.partId);
                }}
                aria-label="조각 찾기"
                className={`absolute rounded-full border-4 ${
                  gone
                    ? "pointer-events-none border-white/25 bg-black/30"
                    : hint === zone.partId
                      ? "jeans-zone-hint border-[#F0C674] bg-[#F0C674]/30"
                      : "jeans-zone border-[#F0C674] bg-[#F0C674]/15"
                }`}
                style={{
                  left: `${zone.x * 100}%`,
                  top: `${zone.y * 100}%`,
                  width: `${zone.r * 200}%`,
                  aspectRatio: "1",
                  transform: "translate(-50%, -50%)",
                }}
              />
            );
          })}
      </div>
    </div>
  );
}
