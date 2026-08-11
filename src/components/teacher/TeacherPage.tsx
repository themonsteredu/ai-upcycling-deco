import Link from "next/link";
import { hasTeacherPassword, isTeacher, signInTeacher } from "@/lib/teacher-auth";
import { TeacherGate } from "./TeacherGate";

/**
 * 선생님 화면 잠금.
 *
 * 선생님 화면이 여럿이라 잠그는 방법을 한 곳에 모아 둔다.
 * 화면 맨 앞에서 한 줄로 부르면 된다.
 *
 *   const blocked = await teacherGuard("재료함 관리");
 *   if (blocked) return blocked;
 *
 * 막을 화면이면 잠금 화면을 돌려주고, 통과면 null을 돌려준다.
 * 자료를 읽기 전에 부르면 남의 손이 닿을 일이 아예 없다.
 */

async function signIn(password: string) {
  "use server";
  return signInTeacher(password);
}

export async function teacherGuard(title: string) {
  if (!hasTeacherPassword()) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16">
        <h1 className="text-xl font-bold">비밀번호가 아직 없습니다</h1>
        <p className="mt-3 leading-relaxed text-slate-600">
          선생님 화면은 비밀번호 하나로 잠급니다. Vercel 환경변수에{" "}
          <code className="rounded bg-slate-200 px-1.5 py-0.5">TEACHER_PASSWORD</code>{" "}
          를 넣고 다시 배포해 주세요.
        </p>
        <Link href="/" className="mt-6 inline-block font-bold text-brand">
          ← 처음으로
        </Link>
      </main>
    );
  }

  if (!(await isTeacher())) {
    return <TeacherGate title={title} onSubmit={signIn} />;
  }

  return null;
}
