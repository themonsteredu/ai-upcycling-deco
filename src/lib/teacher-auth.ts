import { createHash } from "node:crypto";
import { cookies } from "next/headers";

/**
 * 선생님 화면 잠금.
 *
 * 계정 시스템은 만들지 않는다. 환경변수에 넣어 둔 비밀번호 하나로만 연다.
 * 비밀번호를 그대로 쿠키에 담지 않고, 뒤섞은 값을 담는다.
 */

export const TEACHER_COOKIE = "moakit-teacher";

function expectedToken() {
  const password = process.env.TEACHER_PASSWORD;
  if (!password) return null;
  return createHash("sha256").update(`moakit:${password}`).digest("hex");
}

/** 비밀번호가 설정되어 있는지 */
export function hasTeacherPassword() {
  return Boolean(process.env.TEACHER_PASSWORD);
}

/** 지금 들어온 사람이 선생님인지 */
export async function isTeacher() {
  const token = expectedToken();
  if (!token) return false;
  const store = await cookies();
  return store.get(TEACHER_COOKIE)?.value === token;
}

/** 비밀번호가 맞으면 쿠키를 심는다 */
export async function signInTeacher(password: string) {
  const token = expectedToken();
  if (!token) return false;
  const given = createHash("sha256").update(`moakit:${password}`).digest("hex");
  if (given !== token) return false;

  const store = await cookies();
  store.set(TEACHER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // 수업 하루를 넘겨 쓸 수 있게 넉넉히 둔다
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return true;
}

export async function signOutTeacher() {
  const store = await cookies();
  store.delete(TEACHER_COOKIE);
}
