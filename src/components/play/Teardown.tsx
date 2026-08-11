"use client";

import { useCallback, useRef, useState } from "react";
import {
  DENIM_PARTS,
  KEYRING_PRICE,
  THROWN_AWAY_PRICE,
  keyringsFrom,
  partById,
} from "@/lib/denim-parts";
import type { JeansPhoto } from "@/lib/jeans-photo";
import { JeansPhotoStage } from "./JeansPhotoStage";
import { JeansSvg } from "./JeansSvg";

type Props = {
  /** 이미 뜯어 둔 조각 (뒤로 갔다 와도 그대로여야 한다) */
  taken: string[];
  chosen: string | null;
  onChange: (next: { taken: string[]; chosen: string | null }) => void;
  /** 다 하고 다음으로. 없으면 버튼이 안 나온다 */
  onDone?: () => void;
  /** 선생님이 올린 실제 청바지 사진. 없으면 앱이 그린 그림을 쓴다 */
  photo?: JeansPhoto | null;
};

const won = (value: number) => value.toLocaleString("ko-KR");

/**
 * 청바지 해체소.
 *
 * 청바지를 톡톡 눌러 조각을 뜯어내고, 마지막에 「내 키링은 어느 조각으로
 * 만들까」를 하나 고른다. 고른 조각은 3D 공방과 갤러리까지 따라간다.
 */
export function Teardown({ taken, chosen, onChange, onDone, photo }: Props) {
  const [justTook, setJustTook] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * 사진은 있는데 누를 자리를 아직 안 찍어 두었으면 쓸 수가 없다.
   * 학생 화면이 0/0으로 텅 비어 고장난 것처럼 보이므로, 그때는
   * 앱이 그린 청바지로 돌아간다.
   */
  const usable = photo && photo.zones.length > 0 ? photo : null;

  /*
   * 사진을 쓸 때는 선생님이 자리를 찍어 둔 조각만 찾을 수 있다.
   * 자리가 없는 조각까지 세면 학생이 영영 못 끝낸다.
   */
  const parts = usable
    ? DENIM_PARTS.filter((part) =>
        usable.zones.some((zone) => zone.partId === part.id),
      )
    : DENIM_PARTS;
  const allTaken = parts.length > 0 && parts.every((part) => taken.includes(part.id));
  const card = partById(justTook ?? "");
  const keyrings = keyringsFrom(parts);

  const pick = useCallback(
    (id: string) => {
      if (taken.includes(id)) return;
      setJustTook(id);
      setHint(null);
      onChange({ taken: [...taken, id], chosen });
    },
    [taken, chosen, onChange],
  );

  const showHint = useCallback(() => {
    const next = parts.find((part) => !taken.includes(part.id));
    if (!next) return;
    setHint(next.id);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2600);
  }, [taken, parts]);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <p className="text-sm font-medium text-brand">첫 번째 활동</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">청바지 해체소</h1>
      <p className="mt-2 leading-relaxed font-light text-slate-600">
        이 청바지는 버려질 예정이었습니다. 반짝이는 곳을 눌러 쓸 만한 조각을
        찾아내 보세요.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <div className="rounded-2xl bg-[#EEF2F6] p-4">
          {usable ? (
            <JeansPhotoStage
              photo={usable}
              taken={taken}
              hint={hint}
              onPick={pick}
            />
          ) : (
            <div className="mx-auto h-[44dvh] max-h-[440px] sm:h-[54dvh]">
              <JeansSvg taken={taken} hint={hint} onPick={pick} />
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="text-xs text-slate-500">
              {parts.filter((part) => taken.includes(part.id)).length} /{" "}
              {parts.length} 조각
            </span>
            {!allTaken && (
              <button
                type="button"
                onClick={showHint}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500"
              >
                어디 있는지 모르겠어요
              </button>
            )}
          </div>
        </div>

        <div>
          {card ? (
            <div className="rounded-2xl border-2 border-brand bg-brand-light p-5">
              <p className="text-xs font-medium text-brand-dark">찾았습니다</p>
              <p className="mt-1 text-xl font-bold">
                {card.name}{" "}
                <span className="text-base font-medium text-slate-500">
                  {card.count}개
                </span>
              </p>
              <p className="mt-3 text-lg font-bold text-brand-dark">
                → {card.becomes}
              </p>
              <p className="mt-1 leading-relaxed text-slate-600">{card.why}</p>
              {card.keyrings > 0 && (
                <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm font-bold text-slate-700">
                  이 조각으로 키링 {card.keyrings}개를 만들 수 있어요
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm leading-relaxed text-slate-400">
              청바지에서 반짝이는 곳을 눌러 보세요.
              <br />그 조각이 무엇이 될 수 있는지 알려드립니다.
            </div>
          )}

          <p className="mt-5 text-xs tracking-wider text-slate-400">조각 바구니</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {parts.map((part) => {
              const found = taken.includes(part.id);
              return (
                <div
                  key={part.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    found
                      ? "bg-brand-light font-bold text-brand-dark"
                      : "bg-slate-100 text-slate-300"
                  }`}
                >
                  {found ? part.name : "아직"}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {allTaken && (
        <section className="mt-6 rounded-2xl bg-[#0B1620] p-6 text-center text-white">
          <p className="text-sm text-slate-300">청바지 한 벌을 다 뜯었습니다</p>
          <p className="mt-2 text-4xl font-bold text-brand">
            키링 {keyrings}개
          </p>
          <p className="mt-4 leading-relaxed text-slate-300">
            헌옷수거함에 넣으면 <b>{won(THROWN_AWAY_PRICE)}원</b>, 키링으로
            만들면{" "}
            <b className="text-white">{won(keyrings * KEYRING_PRICE)}원</b>
          </p>
        </section>
      )}

      {allTaken && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">
            내 키링은 어느 조각으로 만들까요?
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            고른 조각은 내 작품 이야기로 끝까지 따라갑니다.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {parts.map((part) => {
              const on = chosen === part.id;
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => onChange({ taken, chosen: part.id })}
                  className={`rounded-xl border-2 p-4 text-left ${
                    on
                      ? "border-brand bg-brand-light"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="block font-bold">{part.name}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {part.becomes}
                  </span>
                </button>
              );
            })}
          </div>

          {onDone && (
            <button
              type="button"
              disabled={!chosen}
              onClick={onDone}
              className="mt-5 w-full rounded-xl bg-brand py-4 text-lg font-bold text-white disabled:opacity-40"
            >
              {chosen
                ? `${partById(chosen)?.name}(으)로 만들러 가기`
                : "조각을 하나 골라 주세요"}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
