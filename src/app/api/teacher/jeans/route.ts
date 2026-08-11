import { NextResponse } from "next/server";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { isTeacher } from "@/lib/teacher-auth";
import { toJeansPhoto, type JeansZone } from "@/lib/jeans-photo";

/**
 * 청바지 해체소에 쓸 실제 청바지 사진. 선생님만 올릴 수 있다.
 *
 * 사진은 자르거나 배경을 지우지 않는다. 찍은 그대로 보여 주는 것이
 * 「수업에서 실제로 자를 그 청바지」라는 느낌을 살린다.
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

/** 앞면 사진을 올리면서 새 청바지 한 벌을 만든다 */
export async function POST(request: Request) {
  const supabase = await guard();
  if (supabase instanceof NextResponse) return supabase;

  const body = (await request.json()) as { front?: string; back?: string };
  if (!body.front?.startsWith("data:image/")) {
    return NextResponse.json({ error: "앞면 사진이 없습니다" }, { status: 400 });
  }

  const put = async (dataUrl: string) => {
    const [head, base64] = dataUrl.split(",");
    const type = head.slice(5, head.indexOf(";")) || "image/jpeg";
    const extension = type === "image/png" ? "png" : "jpg";
    const path = `jeans/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, Buffer.from(base64, "base64"), {
        contentType: type,
        upsert: false,
      });
    if (upload.error) throw new Error(upload.error.message);
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  };

  try {
    const frontUrl = await put(body.front);
    const backUrl = body.back?.startsWith("data:image/")
      ? await put(body.back)
      : null;

    const insert = await supabase
      .from("upcycling_jeans")
      .insert({ front_url: frontUrl, back_url: backUrl, zones: [] })
      .select("id, front_url, back_url, zones")
      .single();
    if (insert.error) {
      return NextResponse.json({ error: insert.error.message }, { status: 500 });
    }
    return NextResponse.json({ jeans: toJeansPhoto(insert.data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "사진을 올리지 못했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 누를 자리를 저장한다. 뒷면 사진만 나중에 붙일 수도 있다 */
export async function PATCH(request: Request) {
  const supabase = await guard();
  if (supabase instanceof NextResponse) return supabase;

  const body = (await request.json()) as {
    id?: string;
    zones?: JeansZone[];
  };
  if (!body.id) {
    return NextResponse.json({ error: "어떤 청바지인지 없습니다" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (Array.isArray(body.zones)) {
    // 값이 0~1 을 벗어나면 화면 밖에 찍혀 영영 못 누른다
    patch.zones = body.zones
      .filter((zone) => zone && typeof zone.partId === "string")
      .map((zone) => ({
        partId: zone.partId,
        side: zone.side === "back" ? "back" : "front",
        x: Math.min(1, Math.max(0, Number(zone.x) || 0)),
        y: Math.min(1, Math.max(0, Number(zone.y) || 0)),
        r: Math.min(0.5, Math.max(0.02, Number(zone.r) || 0.08)),
      }));
  }

  const { error } = await supabase
    .from("upcycling_jeans")
    .update(patch)
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
