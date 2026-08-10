/**
 * 이미 다듬어 놓은 재료에서 "안쪽 구멍"만 골라 뚫는다.
 *
 * 단추 가운데의 실 구멍처럼 사방이 막힌 곳은 바깥에서 시작하는 배경 지우기로는
 * 없앨 수 없다. 그래서 선생님이 구멍을 직접 톡 누르면, 그 자리 색과 이어진
 * 부분만 투명하게 만든다.
 *
 * 톡 누른 자리에서 색이 비슷한 이웃으로 번져 나가는 방식이라, 구멍 밖의
 * 단추 몸통까지 넘어가지 않는다.
 */

/** 이 비율 안쪽은 완전히 지우고, 바깥 테두리는 반투명으로 부드럽게 잇는다 */
const SOFT_EDGE = 0.72;

export type PunchResult = {
  /** 실제로 지워진 점의 개수 */
  removed: number;
};

/**
 * @param data   캔버스에서 꺼낸 픽셀 (직접 고쳐 쓴다)
 * @param seedX  누른 자리의 가로 위치 (픽셀)
 * @param seedY  누른 자리의 세로 위치 (픽셀)
 * @param tolerance 얼마나 비슷한 색까지 같은 구멍으로 볼지 (0~255)
 */
export function punchHoleAt(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  tolerance: number,
): PunchResult {
  const x0 = Math.round(seedX);
  const y0 = Math.round(seedY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return { removed: 0 };

  const seed = (y0 * width + x0) * 4;
  if (data[seed + 3] < 8) return { removed: 0 }; // 이미 뚫린 자리

  const key = { r: data[seed], g: data[seed + 1], b: data[seed + 2] };
  const inner = tolerance * SOFT_EDGE;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [x0, y0];
  let removed = 0;

  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const index = y * width + x;
    if (visited[index]) continue;
    visited[index] = 1;

    const offset = index * 4;
    if (data[offset + 3] < 8) continue;
    const distance = Math.hypot(
      data[offset] - key.r,
      data[offset + 1] - key.g,
      data[offset + 2] - key.b,
    );
    if (distance > tolerance) continue;

    const alpha =
      distance <= inner
        ? 0
        : ((distance - inner) / (tolerance - inner)) * data[offset + 3];
    if (alpha < data[offset + 3]) {
      data[offset + 3] = alpha;
      removed++;
    }

    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  return { removed };
}
