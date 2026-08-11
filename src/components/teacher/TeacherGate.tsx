"use client";

import { useState } from "react";

type Props = {
  /** 어느 화면으로 들어가려는지 */
  title: string;
  /** 비밀번호가 맞으면 참을 돌려주는 서버 동작 */
  onSubmit: (password: string) => Promise<boolean>;
};

/** 선생님 화면 잠금 */
export function TeacherGate({ title, onSubmit }: Props) {
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <p className="text-sm font-medium text-brand">선생님 화면</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm font-light text-slate-500">
        비밀번호를 넣어 주세요.
      </p>

      <form
        className="mt-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const ok = await onSubmit(password);
          setBusy(false);
          setWrong(!ok);
          if (ok) window.location.reload();
        }}
      >
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setWrong(false);
          }}
          autoFocus
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg"
        />
        {wrong && (
          <p className="mt-2 text-sm text-rose-500">비밀번호가 맞지 않습니다.</p>
        )}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-4 w-full rounded-xl bg-brand py-3 font-bold text-white disabled:opacity-40"
        >
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </main>
  );
}
