"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import type { PillowShape } from "@/lib/pillow-geometry";
import { HARDWARE_REACH, KeyringBase } from "./KeyringBase";
import { Sticker } from "./Sticker";
import {
  BASE_LABEL,
  DRAFT_STORAGE_KEY,
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

/** 표면 법선과 기울기로부터 부자재가 누울 방향을 만든다 */
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

type SurfaceHit = { point: THREE.Vector3; normal: THREE.Vector3 };

type PendingTap =
  | { kind: "surface"; hit: SurfaceHit }
  | { kind: "sticker"; id: string }
  | { kind: "empty" };

type Props = {
  materials: Material[];
  availableBases: BaseType[];
};

/**
 * 저장해 둔 작업 내용을 읽어온다.
 * 이 컴포넌트는 브라우저에서만 그려지므로 첫 렌더 때 바로 읽을 수 있다.
 */
function readDraft(
  availableBases: BaseType[],
  materials: Material[],
): WorkshopDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as WorkshopDraft;
    const known = new Set(materials.map((m) => m.id));
    return {
      baseType: availableBases.includes(draft?.baseType)
        ? draft.baseType
        : (availableBases[0] ?? "denim"),
      // 그 사이 사라진 부자재가 있으면 걸러낸다
      placements: Array.isArray(draft?.placements)
        ? draft.placements.filter((p) => known.has(p.materialId))
        : [],
    };
  } catch {
    // 저장된 내용이 깨졌으면 그냥 새로 시작한다
    return null;
  }
}

export function Workshop({ materials, availableBases }: Props) {
  const [initialDraft] = useState(() => readDraft(availableBases, materials));
  const [baseType, setBaseType] = useState<BaseType>(
    initialDraft?.baseType ?? availableBases[0] ?? "denim",
  );
  const [placements, setPlacements] = useState<Placement[]>(
    initialDraft?.placements ?? [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trayMaterialId, setTrayMaterialId] = useState<string | null>(null);
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const [frame, setFrame] = useState<{
    cx: number;
    cy: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });

  const containerRef = useRef<HTMLDivElement>(null);
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

  const materialById = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials],
  );
  const selected = placements.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  /* ---------- 작업 내용 저장 · 복구 (뒤로 갔다 와도 날아가지 않게) ---------- */

  useEffect(() => {
    const draft: WorkshopDraft = { baseType, placements };
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // 저장 공간이 없어도 작업은 계속되어야 한다
    }
  }, [baseType, placements]);

  /* ---------- 화면에 꽉 차게 맞추기 ---------- */

  const handleShapeReady = useCallback((shape: PillowShape | null) => {
    if (!shape) {
      setFrame(null);
      return;
    }
    const { minX, maxX, minY, maxY } = shape.extent;
    let left = minX;
    let right = maxX;
    if (shape.strapTip) {
      // 금속 링과 손목줄이 끈 바깥으로 더 뻗는다
      const reach = shape.strapTip.x + shape.strapTip.outward * HARDWARE_REACH;
      left = Math.min(left, reach);
      right = Math.max(right, reach);
    }
    setFrame({
      cx: (left + right) / 2,
      cy: (minY + maxY) / 2,
      width: right - left,
      height: maxY - minY,
    });
  }, []);

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
    // 세로로도 가로로도 잘리지 않는 거리를 고른다
    const distance =
      Math.max(frame.height / 2 / half, frame.width / 2 / half / aspect, 1.5) *
      1.22;
    return {
      fov,
      distance,
      position: [frame.cx, frame.cy, distance] as [number, number, number],
      target: [frame.cx, frame.cy, 0] as [number, number, number],
    };
  }, [frame, viewport]);

  /* ---------- 부자재 조작 ---------- */

  const updateSelected = useCallback(
    (patch: (p: Placement) => Placement) => {
      setPlacements((prev) =>
        prev.map((p) => (p.id === selectedIdRef.current ? patch(p) : p)),
      );
    },
    [],
  );

  const setSize = useCallback(
    (size: number) => {
      const next = clamp(size, SIZE_MIN, SIZE_MAX);
      updateSelected((p) => ({ ...p, size: next }));
    },
    [updateSelected],
  );

  const setRoll = useCallback(
    (roll: number) => {
      updateSelected((p) => {
        const normal = Z_AXIS.clone().applyQuaternion(
          new THREE.Quaternion(...p.quaternion),
        );
        const q = surfaceQuaternion(normal, roll);
        return { ...p, roll, quaternion: [q.x, q.y, q.z, q.w] };
      });
    },
    [updateSelected],
  );

  const removeSelected = useCallback(() => {
    setPlacements((prev) => prev.filter((p) => p.id !== selectedIdRef.current));
    setSelectedId(null);
  }, []);

  const undo = useCallback(() => {
    setPlacements((prev) => prev.slice(0, -1));
    setSelectedId(null);
  }, []);

  const clearAll = useCallback(() => {
    if (placements.length === 0) return;
    if (!window.confirm("붙인 것을 모두 지울까요?")) return;
    setPlacements([]);
    setSelectedId(null);
  }, [placements.length]);

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

      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > TAP_SLOP_PX) return; // 돌리려고 끈 것이므로 아무 일도 하지 않는다

      const tap = pendingTap.current;
      if (tap.kind === "sticker") {
        setSelectedId(tap.id);
        return;
      }
      if (tap.kind === "empty") {
        setSelectedId(null);
        return;
      }

      // 키링 표면을 톡 눌렀다 — 고른 부자재가 있으면 그 자리에 붙인다
      if (!trayMaterialId) {
        setSelectedId(null);
        return;
      }
      const q = surfaceQuaternion(tap.hit.normal, 0);
      const placement: Placement = {
        id: crypto.randomUUID(),
        materialId: trayMaterialId,
        position: [tap.hit.point.x, tap.hit.point.y, tap.hit.point.z],
        quaternion: [q.x, q.y, q.z, q.w],
        roll: 0,
        size: 1,
      };
      setPlacements((prev) => [...prev, placement]);
      setSelectedId(placement.id);
    },
    [trayMaterialId],
  );

  const handleSurfacePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!event.face) return;
      pendingTap.current = {
        kind: "surface",
        hit: { point: event.point.clone(), normal: event.face.normal.clone() },
      };
    },
    [],
  );

  /** 선택된 부자재를 끌어서 표면 위로 옮긴다 */
  const handleSurfacePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const id = draggingId.current;
      if (!id || !event.face) return;
      const point = event.point.clone();
      const normal = event.face.normal.clone();
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

  const handleStickerPointerDown = useCallback(
    (id: string) => (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      pendingTap.current = { kind: "sticker", id };
      // 이미 선택된 것이면 끌어서 옮기기 시작
      if (selectedIdRef.current === id) {
        draggingId.current = id;
        setControlsEnabled(false);
      }
    },
    [],
  );

  /* ---------- 두 손가락: 핀치로 크기, 비틀기로 기울기 ---------- */

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const twoFingers = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return {
        distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        angle: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX),
      };
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const id = selectedIdRef.current;
      if (!id) return; // 선택된 게 없으면 평소대로 화면 확대·축소
      const current = placements.find((p) => p.id === id);
      if (!current) return;
      const { distance, angle } = twoFingers(event.touches);
      gesture.current = { distance, angle, size: current.size, roll: current.roll };
      setControlsEnabled(false);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!gesture.current || event.touches.length !== 2) return;
      event.preventDefault();
      const { distance, angle } = twoFingers(event.touches);
      const start = gesture.current;
      setSize(start.size * (distance / start.distance));
      // 화면 좌표는 아래가 +y라서 부호를 뒤집어야 손가락 방향과 같아진다
      setRoll(start.roll - (angle - start.angle));
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
  }, [placements, setSize, setRoll]);

  /* ---------- 화면 ---------- */

  const toolbarPosition = useMemo(() => {
    if (!selected) return null;
    const normal = Z_AXIS.clone().applyQuaternion(
      new THREE.Quaternion(...selected.quaternion),
    );
    return new THREE.Vector3(...selected.position).addScaledVector(normal, 0.45);
  }, [selected]);

  return (
    <div className="flex h-dvh flex-col-reverse lg:flex-row">
      {/* 재료함 — 넓은 화면에서는 왼쪽 세로, 태블릿 세로 화면에서는 아래쪽 가로 스크롤 */}
      <aside className="shrink-0 border-t border-slate-200 bg-white lg:w-52 lg:border-t-0 lg:border-r">
        <p className="hidden px-4 pt-4 text-sm font-bold lg:block">재료함</p>
        {materials.length === 0 ? (
          <p className="p-4 text-xs leading-relaxed text-slate-500">
            부자재 사진이 아직 없습니다.
            <br />
            <code>public/materials/</code> 폴더에 넣어 주세요.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
            {materials.map((material) => {
              const active = trayMaterialId === material.id;
              return (
                <button
                  key={material.id}
                  type="button"
                  onClick={() =>
                    setTrayMaterialId(active ? null : material.id)
                  }
                  className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-2 lg:w-full lg:flex-row lg:gap-3 ${
                    active
                      ? "border-brand bg-brand-light"
                      : "border-transparent bg-slate-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={material.imageUrl}
                    alt={material.name}
                    className="h-12 w-12 object-contain"
                  />
                  <span className="truncate text-[11px] leading-tight text-slate-600">
                    {material.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* 3D 화면 */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 p-3">
          {availableBases.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setBaseType(type)}
              className={`rounded-full px-4 py-2 text-sm font-bold shadow-sm ${
                baseType === type
                  ? "bg-brand text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              {BASE_LABEL[type]}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={placements.length === 0}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm disabled:opacity-40"
            >
              방금 것 취소
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={placements.length === 0}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm disabled:opacity-40"
            >
              전체 지우기
            </button>
          </div>
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
            /* 사진 색을 그대로 살리기 위해 자동 밝기 보정을 끈다 */
            gl={{ toneMapping: THREE.NoToneMapping }}
          >
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
              three는 빛의 세기를 원주율로 나누어 쓰므로, 사진 색을 그대로
              재현하려면 전체 세기의 합이 약 3.14가 되어야 한다.
              그중 일부만 방향광으로 돌려서 돌릴 때 입체감이 남게 한다.
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
              />
              {placements.map((placement) => {
                const material = materialById.get(placement.materialId);
                if (!material) return null;
                return (
                  <Sticker
                    key={placement.id}
                    placement={placement}
                    material={material}
                    selected={placement.id === selectedId}
                    onPointerDown={handleStickerPointerDown(placement.id)}
                  />
                );
              })}
              {selected && toolbarPosition && (
                <Html position={toolbarPosition} center zIndexRange={[20, 10]}>
                  <div className="flex items-center gap-1 rounded-full bg-white/95 p-1 shadow-lg ring-1 ring-slate-200">
                    <ToolButton
                      label="작게"
                      onClick={() => setSize(selected.size - 0.15)}
                    >
                      −
                    </ToolButton>
                    <ToolButton
                      label="크게"
                      onClick={() => setSize(selected.size + 0.15)}
                    >
                      +
                    </ToolButton>
                    <ToolButton
                      label="왼쪽으로 기울이기"
                      onClick={() => setRoll(selected.roll + Math.PI / 12)}
                    >
                      ↺
                    </ToolButton>
                    <ToolButton
                      label="오른쪽으로 기울이기"
                      onClick={() => setRoll(selected.roll - Math.PI / 12)}
                    >
                      ↻
                    </ToolButton>
                    <ToolButton label="떼어내기" onClick={removeSelected} danger>
                      ✕
                    </ToolButton>
                  </div>
                </Html>
              )}
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

        <p className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-center text-xs text-slate-500">
          {trayMaterialId
            ? "키링을 톡 누르면 그 자리에 붙습니다"
            : selected
              ? "핀치로 크기 · 두 손가락 비틀기로 기울기 · 끌어서 위치 이동"
              : "빈 곳을 끌면 키링이 돌아갑니다"}
        </p>
      </div>
    </div>
  );
}

function ToolButton({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      className={`h-9 w-9 rounded-full text-lg font-bold leading-none ${
        danger ? "text-rose-500" : "text-slate-700"
      } active:bg-slate-100`}
    >
      {children}
    </button>
  );
}
