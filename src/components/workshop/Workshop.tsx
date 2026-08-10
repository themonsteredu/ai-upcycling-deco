"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { autoTrimImage } from "@/lib/auto-trim";
import type { PillowShape } from "@/lib/pillow-geometry";
import { HOOK_HEIGHT } from "./Hook";
import { KeyringBase } from "./KeyringBase";
import { Deco } from "./Deco";
import {
  BASE_LABEL,
  DRAFT_STORAGE_KEY,
  HOOK_SIZE_MAX,
  HOOK_SIZE_MIN,
  SIZE_MAX,
  SIZE_MIN,
  type BaseType,
  type Material,
  type Placement,
  type WorkshopDraft,
} from "@/lib/workshop-types";

/** 이 거리 안에서 손을 떼면 "톡 누른 것", 넘으면 "끌어서 돌린 것" */
const TAP_SLOP_PX = 6;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function surfaceQuaternion(normal: THREE.Vector3, roll: number) {
  const stand = new THREE.Quaternion().setFromUnitVectors(
    Z_AXIS,
    normal.clone().normalize(),
  );
  const spin = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, roll);
  return stand.multiply(spin);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type PendingTap =
  | { kind: "surface"; point: THREE.Vector3; normal: THREE.Vector3 }
  | { kind: "deco"; id: string }
  | { kind: "empty" };

type Props = {
  materials: Material[];
  /** 저장소 public/hooks 에 들어 있는 고리. 모든 학생에게 똑같이 보인다 */
  hooks: Material[];
  availableBases: BaseType[];
};

function readDraft(availableBases: BaseType[]): WorkshopDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as WorkshopDraft;
    return {
      baseType: availableBases.includes(draft?.baseType)
        ? draft.baseType
        : (availableBases[0] ?? "denim"),
      placements: Array.isArray(draft?.placements) ? draft.placements : [],
      addedMaterials: Array.isArray(draft?.addedMaterials)
        ? draft.addedMaterials
        : [],
      hookMaterials: Array.isArray(draft?.hookMaterials)
        ? draft.hookMaterials
        : [],
      hookId: draft?.hookId ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * 넣은 사진의 배경을 자동으로 지우고 딱 맞게 잘라, 브라우저에 담을 수 있는
 * 크기로 만든다. 자동으로 안 되면 원본을 그대로 쓴다.
 */
function prepareUpload(file: File, punchHoles = false) {
  return new Promise<{ dataUrl: string; aspect: number; trimmed: boolean } | null>(
    (resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const result = autoTrimImage(image, punchHoles);
        URL.revokeObjectURL(objectUrl);
        if (!result) {
          resolve(null);
          return;
        }
        resolve({
          dataUrl: result.dataUrl,
          aspect: result.aspect,
          trimmed: result.removedBackground,
        });
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      image.src = objectUrl;
    },
  );
}

/**
 * 저장소 폴더에서 온 사진도 넣을 때와 똑같이 배경을 지우고 잘라 준다.
 * 선생님이 폴더에 그냥 넣어도 손질 없이 바로 쓸 수 있어야 한다.
 */
function trimFolderMaterial(material: Material, punchHoles: boolean) {
  return new Promise<Material>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const result = autoTrimImage(image, punchHoles);
      resolve(
        result
          ? { ...material, imageUrl: result.dataUrl, aspect: result.aspect }
          : material,
      );
    };
    image.onerror = () => resolve(material);
    image.src = material.imageUrl;
  });
}

export function Workshop({ materials, hooks, availableBases }: Props) {
  const [initialDraft] = useState(() => readDraft(availableBases));
  const [baseType, setBaseType] = useState<BaseType>(
    initialDraft?.baseType ?? availableBases[0] ?? "denim",
  );
  const [placements, setPlacements] = useState<Placement[]>(
    initialDraft?.placements ?? [],
  );
  const [addedMaterials, setAddedMaterials] = useState<Material[]>(
    initialDraft?.addedMaterials ?? [],
  );
  const [hookMaterials, setHookMaterials] = useState<Material[]>(
    initialDraft?.hookMaterials ?? [],
  );
  const [hookId, setHookId] = useState<string | null>(
    initialDraft?.hookId ?? null,
  );
  const [hookScale, setHookScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [size, setSizeState] = useState(1);
  const [rollDeg, setRollDeg] = useState(0);
  const [mode, setMode] = useState<"put" | "remove">("put");
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const [baseShape, setBaseShape] = useState<{
    extent: PillowShape["extent"];
    strapTip: PillowShape["strapTip"];
  } | null>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const [toast, setToast] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const setFileRef = useRef<HTMLInputElement>(null);
  const hookFileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const pendingTap = useRef<PendingTap>({ kind: "empty" });
  const draggingId = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const gesture = useRef<{
    distance: number;
    angle: number;
    size: number;
    roll: number;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 폴더 사진은 다듬은 뒤에 쓴다
  const [folderMaterials, setFolderMaterials] = useState<Material[]>(materials);
  const [folderHooks, setFolderHooks] = useState<Material[]>(hooks);

  useEffect(() => {
    let alive = true;
    Promise.all(materials.map((m) => trimFolderMaterial(m, false))).then(
      (list) => {
        if (alive) setFolderMaterials(list);
      },
    );
    return () => {
      alive = false;
    };
  }, [materials]);

  useEffect(() => {
    let alive = true;
    // 고리는 가운데 구멍까지 뚫는다
    Promise.all(hooks.map((h) => trimFolderMaterial(h, true))).then((list) => {
      if (alive) setFolderHooks(list);
    });
    return () => {
      alive = false;
    };
  }, [hooks]);

  const allMaterials = useMemo(
    () => [...folderMaterials, ...addedMaterials],
    [folderMaterials, addedMaterials],
  );
  const materialById = useMemo(
    () => new Map(allMaterials.map((m) => [m.id, m])),
    [allMaterials],
  );
  const picked = pickedId ? materialById.get(pickedId) : undefined;
  const allHooks = useMemo(
    () => [...folderHooks, ...hookMaterials],
    [folderHooks, hookMaterials],
  );
  const hookMaterial = allHooks.find((m) => m.id === hookId) ?? null;
  const selected = placements.find((p) => p.id === selectedId) ?? null;
  const usedKinds = new Set(placements.map((p) => p.materialId)).size;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const say = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  /* ---------- 작업 내용 저장 ---------- */

  useEffect(() => {
    const draft: WorkshopDraft = {
      baseType,
      placements,
      addedMaterials,
      hookMaterials,
      hookId,
    };
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // 저장 공간이 부족해도 작업은 계속되어야 한다
    }
  }, [baseType, placements, addedMaterials, hookMaterials, hookId]);

  /* ---------- 화면에 꽉 차게 맞추기 ---------- */

  const handleShapeReady = useCallback((shape: PillowShape | null) => {
    setBaseShape(
      shape ? { extent: shape.extent, strapTip: shape.strapTip } : null,
    );
  }, []);

  /** 키링과 고리를 모두 담는 범위 */
  const frame = useMemo(() => {
    if (!baseShape) return null;
    const { minX, maxX, minY, maxY } = baseShape.extent;
    let left = minX;
    let right = maxX;
    let top = maxY;
    let bottom = minY;

    if (hookMaterial && baseShape.strapTip) {
      const tip = baseShape.strapTip;
      const hookHeight = HOOK_HEIGHT * hookScale;
      const hookWidth = hookHeight * (hookMaterial.aspect ?? 1);
      const far = tip.x + tip.outward * hookWidth;
      left = Math.min(left, far);
      right = Math.max(right, far);
      top = Math.max(top, tip.y + hookHeight / 2);
      bottom = Math.min(bottom, tip.y - hookHeight / 2);
    }

    return {
      cx: (left + right) / 2,
      cy: (bottom + top) / 2,
      width: right - left,
      height: top - bottom,
    };
  }, [baseShape, hookMaterial, hookScale]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const view = useMemo(() => {
    if (!frame) return null;
    const fov = 40;
    const half = Math.tan((fov * Math.PI) / 360);
    const aspect = viewport.width / viewport.height;
    const distance =
      Math.max(frame.height / 2 / half, frame.width / 2 / half / aspect, 1.5) * 1.3;
    return {
      fov,
      distance,
      position: [frame.cx, frame.cy, distance] as [number, number, number],
      target: [frame.cx, frame.cy, 0] as [number, number, number],
    };
  }, [frame, viewport]);

  /* ---------- 부자재 조작 ---------- */

  const updateSelected = useCallback((patch: (p: Placement) => Placement) => {
    setPlacements((prev) =>
      prev.map((p) => (p.id === selectedIdRef.current ? patch(p) : p)),
    );
  }, []);

  const applySize = useCallback(
    (value: number) => {
      const next = clamp(value, SIZE_MIN, SIZE_MAX);
      setSizeState(next);
      if (selectedIdRef.current) updateSelected((p) => ({ ...p, size: next }));
    },
    [updateSelected],
  );

  const applyRoll = useCallback(
    (degrees: number) => {
      const wrapped = ((Math.round(degrees) % 360) + 360) % 360;
      setRollDeg(wrapped);
      if (!selectedIdRef.current) return;
      updateSelected((p) => {
        const normal = Z_AXIS.clone().applyQuaternion(
          new THREE.Quaternion(...p.quaternion),
        );
        const roll = (wrapped * Math.PI) / 180;
        const q = surfaceQuaternion(normal, roll);
        return { ...p, roll, quaternion: [q.x, q.y, q.z, q.w] };
      });
    },
    [updateSelected],
  );

  const undo = useCallback(() => {
    if (placements.length === 0) {
      say("되돌릴 것이 없어요");
      return;
    }
    setPlacements((prev) => prev.slice(0, -1));
    setSelectedId(null);
  }, [placements.length, say]);

  const clearAll = useCallback(() => {
    if (placements.length === 0) {
      say("아직 붙인 게 없어요");
      return;
    }
    if (!window.confirm("붙인 것을 모두 지울까요?")) return;
    setPlacements([]);
    setSelectedId(null);
    say("깨끗하게 지웠어요");
  }, [placements.length, say]);

  /* ---------- 톡 누르기 · 끌기 구분 ---------- */

  const handlePointerDownCapture = useCallback((event: React.PointerEvent) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
    pendingTap.current = { kind: "empty" };
  }, []);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      const start = pointerStart.current;
      draggingId.current = null;
      setControlsEnabled(true);
      pointerStart.current = null;
      if (!start) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX)
        return;

      const tap = pendingTap.current;

      if (mode === "remove") {
        if (tap.kind === "deco") {
          setPlacements((prev) => prev.filter((p) => p.id !== tap.id));
          setSelectedId(null);
        }
        return;
      }

      if (tap.kind === "deco") {
        const target = placements.find((p) => p.id === tap.id);
        setSelectedId(tap.id);
        if (target) {
          setSizeState(target.size);
          setRollDeg(Math.round((target.roll * 180) / Math.PI));
        }
        return;
      }
      if (tap.kind === "empty") {
        setSelectedId(null);
        return;
      }

      if (!picked) {
        say("재료함에서 재료를 먼저 골라주세요");
        return;
      }
      const roll = (rollDeg * Math.PI) / 180;
      const q = surfaceQuaternion(tap.normal, roll);
      const placement: Placement = {
        id: crypto.randomUUID(),
        materialId: picked.id,
        position: [tap.point.x, tap.point.y, tap.point.z],
        quaternion: [q.x, q.y, q.z, q.w],
        roll,
        size,
      };
      setPlacements((prev) => [...prev, placement]);
      setSelectedId(placement.id);
    },
    [mode, picked, placements, rollDeg, size, say],
  );

  const handleSurfacePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!event.face) return;
      const normal = event.face.normal.clone();
      // 만져지는 면이 늘 카메라 쪽을 보도록 맞춘다.
      // 뒤집힌 면에 붙으면 부자재가 키링 속으로 파묻힌다.
      if (normal.dot(event.camera.position.clone().sub(event.point)) < 0) {
        normal.negate();
      }
      pendingTap.current = { kind: "surface", point: event.point.clone(), normal };
    },
    [],
  );

  const handleSurfacePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const id = draggingId.current;
      if (!id || !event.face) return;
      const point = event.point.clone();
      const normal = event.face.normal.clone();
      if (normal.dot(event.camera.position.clone().sub(point)) < 0) normal.negate();
      setPlacements((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const q = surfaceQuaternion(normal, p.roll);
          return {
            ...p,
            position: [point.x, point.y, point.z],
            quaternion: [q.x, q.y, q.z, q.w],
          };
        }),
      );
    },
    [],
  );

  const handleDecoPointerDown = useCallback(
    (id: string) => (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      pendingTap.current = { kind: "deco", id };
      if (selectedIdRef.current === id && mode === "put") {
        draggingId.current = id;
        setControlsEnabled(false);
      }
    },
    [mode],
  );

  /* ---------- 두 손가락: 핀치로 크기, 비틀기로 기울기 ---------- */

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return {
        distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        angle: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX),
      };
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const id = selectedIdRef.current;
      if (!id) return;
      const current = placements.find((p) => p.id === id);
      if (!current) return;
      const { distance, angle } = measure(event.touches);
      gesture.current = {
        distance,
        angle,
        size: current.size,
        roll: (current.roll * 180) / Math.PI,
      };
      setControlsEnabled(false);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!gesture.current || event.touches.length !== 2) return;
      event.preventDefault();
      const { distance, angle } = measure(event.touches);
      const start = gesture.current;
      applySize(start.size * (distance / start.distance));
      // 화면 좌표는 아래가 +y라서 부호를 뒤집어야 손가락 방향과 같아진다
      applyRoll(start.roll - ((angle - start.angle) * 180) / Math.PI);
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length >= 2) return;
      gesture.current = null;
      setControlsEnabled(true);
    };

    element.addEventListener("touchstart", onTouchStart, { passive: false });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd);
    element.addEventListener("touchcancel", onTouchEnd);
    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [placements, applySize, applyRoll]);

  /* ---------- 재료 넣기 · 세트 저장 ---------- */

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const loaded = await Promise.all(
        Array.from(files)
          .filter((file) => file.type.startsWith("image/"))
          .map(async (file) => {
            const prepared = await prepareUpload(file);
            if (!prepared) return null;
            const material: Material = {
              id: `added-${crypto.randomUUID()}`,
              name: file.name.replace(/\.[^.]+$/, "").slice(0, 10),
              imageUrl: prepared.dataUrl,
              aspect: prepared.aspect,
              category: "기타",
              baseScale: 1,
            };
            return { material, trimmed: prepared.trimmed };
          }),
      );
      const ok = loaded.filter((item) => item !== null);
      if (ok.length === 0) {
        say("사진을 읽지 못했어요");
        return;
      }
      setAddedMaterials((prev) => [...prev, ...ok.map((item) => item.material)]);
      const trimmedCount = ok.filter((item) => item.trimmed).length;
      say(
        trimmedCount > 0
          ? `${ok.length}개 넣었어요 · 배경 ${trimmedCount}개 지움`
          : `${ok.length}개 재료를 넣었어요`,
      );
    },
    [say],
  );

  const addHookFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const loaded = await Promise.all(
        Array.from(files)
          .filter((file) => file.type.startsWith("image/"))
          .map(async (file) => {
            // 고리는 가운데가 뚫려 있어야 하므로 안쪽 배경까지 지운다
            const prepared = await prepareUpload(file, true);
            if (!prepared) return null;
            const material: Material = {
              id: `hook-${crypto.randomUUID()}`,
              name: file.name.replace(/\.[^.]+$/, "").slice(0, 10),
              imageUrl: prepared.dataUrl,
              aspect: prepared.aspect,
              category: "기타",
              baseScale: 1,
            };
            return material;
          }),
      );
      const added: Material[] = loaded.filter((m) => m !== null);
      if (added.length === 0) {
        say("사진을 읽지 못했어요");
        return;
      }
      setHookMaterials((prev) => [...prev, ...added]);
      setHookId(added[0].id);
      say(`고리 ${added.length}개를 넣었어요`);
    },
    [say],
  );

  const exportSet = useCallback(() => {
    const blob = new Blob([JSON.stringify(addedMaterials, null, 1)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "재료세트.json";
    link.click();
    URL.revokeObjectURL(link.href);
    say("재료 세트를 저장했어요");
  }, [addedMaterials, say]);

  const importSet = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as Material[];
          if (!Array.isArray(parsed)) throw new Error("형식이 맞지 않습니다");
          setAddedMaterials(parsed);
          say("재료 세트를 불러왔어요");
        } catch {
          say("세트 파일을 읽을 수 없어요");
        }
      };
      reader.readAsText(file);
    },
    [say],
  );

  const saveImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `내키링-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    say("사진으로 저장했어요!");
  }, [say]);

  /* ---------- 화면 ---------- */

  const step = !pickedId ? 1 : placements.length > 0 ? 3 : 2;
  const stepClass = (n: number) => (step === n ? "text-brand" : "text-slate-500");

  return (
    <div className="flex h-dvh flex-col bg-[#0B1620] text-[#DCE9EF] lg:flex-row">
      {/* 왼쪽 — 원단과 재료함 */}
      <aside className="order-2 flex max-h-[24dvh] shrink-0 flex-col border-t border-[#23404F] bg-[#12222E] lg:order-1 lg:max-h-none lg:w-60 lg:border-t-0 lg:border-r">
        <div className="hidden border-b border-[#23404F] px-4 py-4 lg:block">
          <p className="text-[15px] font-bold tracking-tight text-white">
            업사이클 키링 <span className="text-brand">디자인</span>
          </p>
          <p className="mt-1.5 text-[11px] font-light text-slate-400">
            버려진 청바지에 새 이야기를 붙여요
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="px-4 pt-3 pb-2 text-[11px] font-light tracking-wider text-slate-400">
            원단 고르기
          </p>
          <div className="flex gap-2 px-3">
            {availableBases.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setBaseType(type)}
                className={`flex-1 rounded-lg border-2 py-2 text-xs font-bold ${
                  baseType === type
                    ? "border-brand bg-brand/15 text-white"
                    : "border-transparent bg-[#182D3C] text-slate-300"
                }`}
              >
                {BASE_LABEL[type]}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-[11px] tracking-wider text-slate-400">재료함</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-[#23404F] bg-[#182D3C] px-2 py-1 text-[11px] text-brand"
            >
              + 재료 넣기
            </button>
          </div>

          {allMaterials.length === 0 && (
            <p className="px-4 py-6 text-center text-[11.5px] leading-relaxed text-slate-400">
              재료함이 비었어요.
              <br />
              위 <b className="text-brand">+ 재료 넣기</b>로 부자재 사진을 넣어 주세요.
            </p>
          )}

          <div className="flex gap-2 overflow-x-auto px-3 lg:grid lg:grid-cols-3 lg:overflow-x-visible">
            {allMaterials.map((material) => {
              const on = pickedId === material.id;
              const removable = material.id.startsWith("added-");
              return (
                <div key={material.id} className="relative w-[4.5rem] shrink-0 lg:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setPickedId(on ? null : material.id);
                      setMode("put");
                    }}
                    className={`w-full rounded-lg border p-1.5 text-center ${
                      on ? "border-brand bg-brand/15" : "border-transparent bg-[#182D3C]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={material.imageUrl}
                      alt=""
                      className="mx-auto h-8 w-8 rounded bg-white/10 object-contain"
                    />
                    <span className="mt-1 block truncate text-[9.5px] text-slate-300">
                      {material.name}
                    </span>
                  </button>
                  {removable && (
                    <button
                      type="button"
                      aria-label={`${material.name} 재료 빼기`}
                      onClick={() => {
                        setAddedMaterials((prev) =>
                          prev.filter((m) => m.id !== material.id),
                        );
                        if (pickedId === material.id) setPickedId(null);
                      }}
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-black/70 text-[10px] text-rose-300"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-[11px] font-light tracking-wider text-slate-400">
              고리
            </span>
            <button
              type="button"
              onClick={() => hookFileRef.current?.click()}
              className="rounded-md border border-[#23404F] bg-[#182D3C] px-2 py-1 text-[11px] text-brand"
            >
              + 고리 넣기
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto px-3">
            <button
              type="button"
              onClick={() => setHookId(null)}
              className={`w-[4.5rem] shrink-0 rounded-lg border py-3 text-[10px] ${
                hookId === null
                  ? "border-brand bg-brand/15 text-white"
                  : "border-transparent bg-[#182D3C] text-slate-400"
              }`}
            >
              없음
            </button>
            {allHooks.map((material) => (
              <div key={material.id} className="relative w-[4.5rem] shrink-0">
                <button
                  type="button"
                  onClick={() => setHookId(material.id)}
                  className={`w-full rounded-lg border p-1.5 text-center ${
                    hookId === material.id
                      ? "border-brand bg-brand/15"
                      : "border-transparent bg-[#182D3C]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={material.imageUrl}
                    alt=""
                    className="mx-auto h-8 w-8 rounded bg-white/10 object-contain"
                  />
                  <span className="mt-1 block truncate text-[9.5px] text-slate-300">
                    {material.name}
                  </span>
                </button>
                {material.id.startsWith("hook-") && (
                  <button
                    type="button"
                    aria-label={`${material.name} 고리 빼기`}
                    onClick={() => {
                      setHookMaterials((prev) =>
                        prev.filter((m) => m.id !== material.id),
                      );
                      if (hookId === material.id) setHookId(null);
                    }}
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-black/70 text-[10px] text-rose-300"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {hookMaterial && (
            <div className="px-4 pt-3">
              <div className="flex justify-between text-[11px] font-light text-slate-400">
                <span>고리 크기</span>
                <span>{Math.round(hookScale * 100)}%</span>
              </div>
              <input
                type="range"
                min={HOOK_SIZE_MIN * 100}
                max={HOOK_SIZE_MAX * 100}
                value={Math.round(hookScale * 100)}
                onChange={(event) =>
                  setHookScale(Number(event.target.value) / 100)
                }
                className="mt-1 w-full accent-brand"
              />
            </div>
          )}

          <div className="hidden gap-2 p-3 lg:flex">
            <button
              type="button"
              onClick={exportSet}
              disabled={addedMaterials.length === 0}
              className="flex-1 rounded-lg border border-[#23404F] bg-[#182D3C] py-2 text-[11px] text-slate-300 disabled:opacity-40"
            >
              세트 저장
            </button>
            <button
              type="button"
              onClick={() => setFileRef.current?.click()}
              className="flex-1 rounded-lg border border-[#23404F] bg-[#182D3C] py-2 text-[11px] text-slate-300"
            >
              세트 불러오기
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={hookFileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void addHookFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={setFileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            importSet(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </aside>

      {/* 가운데 — 3D 무대 */}
      <div className="relative order-1 min-h-[40dvh] flex-1 lg:order-2 lg:min-h-0">
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 hidden -translate-x-1/2 rounded-full border border-[#23404F] bg-[#12222E]/90 px-4 py-2 text-xs whitespace-nowrap sm:block">
          <span className={stepClass(1)}>① 재료 고르기</span>
          <span className="mx-2 text-[#33566a]">→</span>
          <span className={stepClass(2)}>② 키링 위를 클릭</span>
          <span className="mx-2 text-[#33566a]">→</span>
          <span className={stepClass(3)}>③ 작품 저장</span>
        </div>

        <div
          ref={containerRef}
          className="h-full w-full touch-none"
          onPointerDownCapture={handlePointerDownCapture}
          onPointerUp={handlePointerUp}
        >
          <Canvas
            camera={{ position: [0, 0, 6], fov: 40 }}
            dpr={[1, 2]}
            gl={{ toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              canvasRef.current = gl.domElement;
            }}
          >
            <color attach="background" args={["#0B1620"]} />
            {view && (
              <PerspectiveCamera
                makeDefault
                fov={view.fov}
                position={view.position}
                near={0.1}
                far={view.distance * 6}
              />
            )}
            {/*
              사진에 이미 빛과 그림자가 담겨 있으므로 거의 평평하게 비춘다.
              three는 빛의 세기를 원주율로 나누어 쓰므로 합이 약 3.14가 되어야
              사진 색이 그대로 나온다.
            */}
            <ambientLight intensity={2.5} />
            <directionalLight position={[2.5, 3.5, 6]} intensity={0.55} />
            <directionalLight position={[-4, -1.5, -5]} intensity={0.35} />
            <Suspense fallback={null}>
              <KeyringBase
                baseType={baseType}
                onSurfacePointerDown={handleSurfacePointerDown}
                onSurfacePointerMove={handleSurfacePointerMove}
                onShapeReady={handleShapeReady}
                hookMaterial={hookMaterial}
                hookScale={hookScale}
              />
              {placements.map((placement) => {
                const material = materialById.get(placement.materialId);
                if (!material) return null;
                return (
                  <Deco
                    key={placement.id}
                    placement={placement}
                    material={material}
                    selected={placement.id === selectedId}
                    onPointerDown={handleDecoPointerDown(placement.id)}
                  />
                );
              })}
            </Suspense>
            <OrbitControls
              enabled={controlsEnabled}
              enablePan={false}
              target={view?.target}
              minDistance={view ? view.distance * 0.45 : 3}
              maxDistance={view ? view.distance * 2.4 : 9}
            />
          </Canvas>
        </div>

        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-slate-400">
          {mode === "remove"
            ? "떼어낼 부자재를 톡 누르세요"
            : selected
              ? "핀치로 크기 · 두 손가락 비틀기로 기울기 · 끌어서 위치 이동"
              : "빈 곳을 끌면 돌아가고, 휠을 굴리면 확대돼요"}
        </p>
      </div>

      {/* 오른쪽 — 조절판 */}
      <aside className="order-3 flex max-h-[32dvh] shrink-0 flex-col overflow-y-auto border-t border-[#23404F] bg-[#12222E] lg:max-h-none lg:w-56 lg:border-t-0 lg:border-l">
        <div className="flex border-b border-[#23404F]">
          <div className="flex-1 py-3 text-center">
            <p className="text-2xl leading-none font-bold text-brand">
              {placements.length}
            </p>
            <p className="mt-1 text-[10.5px] text-slate-400">붙인 개수</p>
          </div>
          <div className="flex-1 border-l border-[#23404F] py-3 text-center">
            <p className="text-2xl leading-none font-bold text-brand">{usedKinds}</p>
            <p className="mt-1 text-[10.5px] text-slate-400">쓴 재료 종류</p>
          </div>
        </div>

        <Section title="모드">
          <div className="flex gap-2">
            {(
              [
                ["put", "붙이기"],
                ["remove", "떼어내기"],
              ] as ["put" | "remove", string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setSelectedId(null);
                }}
                className={`flex-1 rounded-lg border py-2 text-xs ${
                  mode === value
                    ? "border-brand bg-brand/15 text-white"
                    : "border-[#23404F] bg-[#182D3C] text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="크기">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>작게</span>
            <span>{size < 0.75 ? "작게" : size > 1.4 ? "크게" : "보통"}</span>
            <span>크게</span>
          </div>
          <input
            type="range"
            min={SIZE_MIN * 100}
            max={SIZE_MAX * 100}
            value={Math.round(size * 100)}
            onChange={(event) => applySize(Number(event.target.value) / 100)}
            className="mt-1 w-full accent-brand"
          />
        </Section>

        <Section title="기울기">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>0°</span>
            <span>{rollDeg}°</span>
            <span>360°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={rollDeg}
            onChange={(event) => applyRoll(Number(event.target.value))}
            className="mt-1 w-full accent-brand"
          />
        </Section>

        <div className="flex flex-col gap-2 p-3">
          <button
            type="button"
            onClick={undo}
            className="rounded-lg border border-[#23404F] bg-[#182D3C] py-2.5 text-xs text-slate-200"
          >
            방금 것 취소
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-[#23404F] bg-[#182D3C] py-2.5 text-xs text-slate-200"
          >
            전체 지우기
          </button>
          <button
            type="button"
            onClick={saveImage}
            className="rounded-lg bg-brand py-2.5 text-xs font-bold text-[#04262A]"
          >
            내 작품 저장하기
          </button>
        </div>
      </aside>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand px-5 py-2 text-sm font-bold text-[#04262A]">
          {toast}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[#23404F] px-4 py-3">
      <h3 className="mb-2 text-[11px] tracking-wider text-slate-400">
        {title}
        {note && <span className="ml-1 text-[10px]">{note}</span>}
      </h3>
      {children}
    </section>
  );
}
