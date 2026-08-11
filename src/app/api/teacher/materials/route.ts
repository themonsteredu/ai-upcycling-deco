import { NextResponse } from "next/server";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { isTeacher } from "@/lib/teacher-auth";

/**
 * 재료함을 고치는 통로. 선생님만 쓸 수 있다.
 *
 * 학생 브라우저는 공개 열쇠로 읽기만 하므로, 여기 오지 못한다.
 * 실제 저장은 서버에서 관리 열쇠로만 일어난다.
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

/** 재료 넣기 */
export async function POST(request: Request) {
  const supabase = await guard();
  if (supabase instanceof NextResponse) return supabase;

  const body = (await request.json()) as {
    name?: string;
    kind?: "deco" | "hook";
    category?: string;
    dataUrl?: string;
  };
  if (!body.dataUrl?.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "사진이 없습니다" }, { status: 400 });
  }

  const bytes = Buffer.from(body.dataUrl.split(",")[1], "base64");
  const kind = body.kind === "hook" ? "hook" : "deco";
  const path = `${kind}/${crypto.randomUUID()}.png`;

  const upload = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

  // 새 재료는 맨 뒤에 붙인다
  const { data: last } = await supabase
    .from("upcycling_materials")
    .select("sort_order")
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const insert = await supabase
    .from("upcycling_materials")
    .insert({
      kind,
      name: (body.name ?? "").slice(0, 20) || "이름 없음",
      category: body.category ?? "기타",
      image_url: publicUrl,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select()
    .single();

  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }
  return NextResponse.json({ material: insert.data });
}

/** 이름·분류·보임/숨김·순서 고치기 */
export async function PATCH(request: Request) {
  const supabase = await guard();
  if (supabase instanceof NextResponse) return supabase;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    category?: string;
    is_active?: boolean;
    /** 순서를 통째로 다시 매길 때 쓴다 */
    order?: string[];
    /** 다듬은 사진으로 갈아 끼울 때 쓴다 (구멍 뚫기 등) */
    dataUrl?: string;
  };

  if (body.order) {
    const updates = body.order.map((id, index) =>
      supabase
        .from("upcycling_materials")
        .update({ sort_order: index })
        .eq("id", id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return NextResponse.json({ error: failed.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.id) {
    return NextResponse.json({ error: "어떤 재료인지 없습니다" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.slice(0, 20);
  if (body.category !== undefined) patch.category = body.category;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  /*
   * 사진을 갈아 끼울 때는 덮어쓰지 않고 새 파일로 올린다.
   * 같은 주소에 덮어쓰면 학생 태블릿이 예전 사진을 계속 붙들고 있는다.
   */
  let imageUrl: string | undefined;
  if (body.dataUrl) {
    if (!body.dataUrl.startsWith("data:image/png;base64,")) {
      return NextResponse.json({ error: "사진 형식이 다릅니다" }, { status: 400 });
    }
    const { data: row } = await supabase
      .from("upcycling_materials")
      .select("kind")
      .eq("id", body.id)
      .maybeSingle();

    const bytes = Buffer.from(body.dataUrl.split(",")[1], "base64");
    const path = `${row?.kind === "hook" ? "hook" : "deco"}/${crypto.randomUUID()}.png`;
    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    imageUrl = publicUrl;
    patch.image_url = publicUrl;
  }

  const { error } = await supabase
    .from("upcycling_materials")
    .update(patch)
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, imageUrl });
}

/**
 * 재료 지우기.
 * 이미 제출된 작품에 쓰인 재료는 지우지 않고 숨김으로 바꾼다.
 * 지워 버리면 그 작품이 갤러리에서 깨지기 때문이다.
 */
export async function DELETE(request: Request) {
  const supabase = await guard();
  if (supabase instanceof NextResponse) return supabase;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "어떤 재료인지 없습니다" }, { status: 400 });
  }

  /*
   * 작품에는 재료 번호가 `saved-` 를 붙인 채로 적혀 있다.
   * 앞의 `saved-` 없이 찾으면 영영 걸리지 않아서, 이미 쓰인 재료도
   * 그냥 지워지고 그 작품이 깨진다.
   */
  const { count } = await supabase
    .from("upcycling_works")
    .select("id", { count: "exact", head: true })
    .contains("placements", [{ materialId: `saved-${id}` }]);

  if ((count ?? 0) > 0) {
    await supabase
      .from("upcycling_materials")
      .update({ is_active: false })
      .eq("id", id);
    return NextResponse.json({
      ok: true,
      hiddenInstead: true,
      message: "이미 만든 작품에 쓰인 재료라 지우지 않고 숨겼습니다",
    });
  }

  const { error } = await supabase
    .from("upcycling_materials")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
