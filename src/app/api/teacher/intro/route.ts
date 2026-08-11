import { NextResponse } from "next/server";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { isTeacher } from "@/lib/teacher-auth";
import { toIntro, type QuizItem } from "@/lib/intro";

/**
 * 수업 도입 자료. 선생님만 고칠 수 있다.
 *
 * 자료는 한 벌만 쓴다. 줄이 없으면 만들고, 있으면 그 줄을 고친다.
 */

async function guard() {
  if (!(await isTeacher())) {
    return NextResponse.json({ error: "선생님만 쓸 수 있습니다" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase 연결이 아직 준비되지 않았습니다" },
      { status: 503 },
    );
  }
  return supabase;
}

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function putPhoto(supabase: Admin, dataUrl: string, folder: string) {
  const [head, base64] = dataUrl.split(",");
  const type = head.slice(5, head.indexOf(";")) || "image/jpeg";
  const extension = type === "image/png" ? "png" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, Buffer.from(base64, "base64"), {
      contentType: type,
      upsert: false,
    });
  if (upload.error) throw new Error(upload.error.message);
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 자료 한 벌을 찾거나 새로 만든다 */
async function findOrCreate(supabase: Admin) {
  const { data } = await supabase
    .from("upcycling_intro")
    .select("id, slides, quiz, use_cards")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) return toIntro(data);

  const insert = await supabase
    .from("upcycling_intro")
    .insert({ slides: [], quiz: [] })
    .select("id, slides, quiz, use_cards")
    .single();
  if (insert.error) throw new Error(insert.error.message);
  return toIntro(insert.data);
}

/** 슬라이드 사진을 여러 장 한 번에 올린다 */
export async function POST(request: Request) {
  const supabase = await guard();
  if (supabase instanceof NextResponse) return supabase;

  const body = (await request.json()) as { slides?: string[] };
  const incoming = (body.slides ?? []).filter((one) =>
    one?.startsWith("data:image/"),
  );
  if (incoming.length === 0) {
    return NextResponse.json({ error: "사진이 없습니다" }, { status: 400 });
  }

  try {
    const intro = await findOrCreate(supabase);
    const added: string[] = [];
    for (const dataUrl of incoming) {
      added.push(await putPhoto(supabase, dataUrl, "slides"));
    }
    const slides = [...intro.slides, ...added];

    const { error } = await supabase
      .from("upcycling_intro")
      .update({ slides, updated_at: new Date().toISOString() })
      .eq("id", intro.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: intro.id, slides });
  } catch (error) {
    const message = error instanceof Error ? error.message : "올리지 못했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 슬라이드 순서·삭제, 퀴즈 문항 저장 */
export async function PATCH(request: Request) {
  const supabase = await guard();
  if (supabase instanceof NextResponse) return supabase;

  const body = (await request.json()) as {
    slides?: string[];
    quiz?: QuizItem[];
    /** 퀴즈 문항에 붙일 새 사진 [{ id, dataUrl }] */
    photos?: { id: string; dataUrl: string }[];
    useCards?: boolean;
  };

  try {
    const intro = await findOrCreate(supabase);
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (Array.isArray(body.slides)) patch.slides = body.slides;
    if (typeof body.useCards === "boolean") patch.use_cards = body.useCards;

    if (Array.isArray(body.quiz)) {
      // 새로 붙인 사진을 먼저 올려 주소로 바꿔 둔다
      const uploaded = new Map<string, string>();
      for (const photo of body.photos ?? []) {
        if (!photo?.dataUrl?.startsWith("data:image/")) continue;
        uploaded.set(photo.id, await putPhoto(supabase, photo.dataUrl, "quiz"));
      }
      patch.quiz = body.quiz.map((item) => ({
        id: String(item.id),
        name: String(item.name ?? "").slice(0, 40),
        possible: Boolean(item.possible),
        reason: String(item.reason ?? "").slice(0, 120),
        imageUrl: uploaded.get(String(item.id)) ?? item.imageUrl ?? null,
      }));
    }

    const { error } = await supabase
      .from("upcycling_intro")
      .update(patch)
      .eq("id", intro.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: intro.id, quiz: patch.quiz ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "저장하지 못했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
