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

/** 사진 하나를 저장 공간에 올리고 공개 주소를 돌려준다 */
async function putPhoto(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  dataUrl: string,
) {
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
}

/** 앞면 사진을 올리면서 새 청바지 한 벌을 만든다 */
export async function POST(request: Request) {
  const supabase = await guard();
  if (supabase instanceof NextResponse) return supabase;

  const body = (await request.json()) as { front?: string };
  if (!body.front?.startsWith("data:image/")) {
    return NextResponse.json({ error: "앞면 사진이 없습니다" }, { status: 400 });
  }

  try {
    const frontUrl = await putPhoto(supabase, body.front);
    const insert = await supabase
      .from("upcycling_jeans")
      .insert({ front_url: frontUrl, back_url: null, zones: [] })
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

/**
 * 누를 자리를 저장하거나, 한쪽 사진만 갈아 끼운다.
 *
 * 사진을 갈면 그 면에 찍어 둔 자리는 좌표가 안 맞으므로 함께 지운다.
 * 남겨 두면 엉뚱한 곳에 동그라미가 떠서 더 헷갈린다.
 */
export async function PATCH(request: Request) {
  const supabase = await guard();
  if (supabase instanceof NextResponse) return supabase;

  const body = (await request.json()) as {
    id?: string;
    zones?: JeansZone[];
    /** 갈아 끼울 사진 (data:image/...) */
    front?: string;
    back?: string;
  };
  if (!body.id) {
    return NextResponse.json({ error: "어떤 청바지인지 없습니다" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const changed: { frontUrl?: string; backUrl?: string } = {};

  try {
    for (const side of ["front", "back"] as const) {
      const dataUrl = body[side];
      if (!dataUrl) continue;
      if (!dataUrl.startsWith("data:image/")) {
        return NextResponse.json({ error: "사진 형식이 다릅니다" }, { status: 400 });
      }
      const url = await putPhoto(supabase, dataUrl);
      patch[`${side}_url`] = url;
      if (side === "front") changed.frontUrl = url;
      else changed.backUrl = url;

      // 갈아 끼운 면의 자리는 좌표가 안 맞으므로 지운다
      const { data: row } = await supabase
        .from("upcycling_jeans")
        .select("zones")
        .eq("id", body.id)
        .maybeSingle();
      const kept = Array.isArray(row?.zones)
        ? (row.zones as JeansZone[]).filter((zone) => zone.side !== side)
        : [];
      patch.zones = kept;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "사진을 올리지 못했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
  return NextResponse.json({ ok: true, ...changed });
}
