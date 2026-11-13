export interface Point { x: number; y: number }
export interface Frame extends Point { width: number; height: number }
export interface Viewport { width: number; height: number; compact: boolean }
export const windowGap = 8;
const maxDimension = (size: number) => Math.max(1, size - windowGap * 2);

export function assistantViewport(): Viewport {
  return { width: document.documentElement.clientWidth, height: window.innerHeight, compact: window.matchMedia('(max-width: 720px)').matches };
}

export function boundPosition(point: Point, width: number, height: number, viewport: Viewport): Point {
  return {
    x: Math.max(windowGap, Math.min(point.x, viewport.width - width - windowGap)),
    y: Math.max(windowGap, Math.min(point.y, viewport.height - height - windowGap)),
  };
}

export function boundFrame(frame: Frame, viewport: Viewport): Frame {
  const width = Math.min(maxDimension(viewport.width), Math.max(330, frame.width));
  const height = Math.min(maxDimension(viewport.height), Math.max(300, frame.height));
  return { ...boundPosition(frame, width, height, viewport), width, height };
}

export function defaultFrame(viewport: Viewport): Frame {
  const width = Math.min(440, maxDimension(viewport.width));
  const height = Math.min(610, maxDimension(viewport.height));
  return boundFrame({ x: viewport.width - width - 20, y: viewport.height - height - 20, width, height }, viewport);
}

export function resizeFrame(frame: Frame, dx: number, dy: number, viewport: Viewport): Frame {
  return boundFrame({
    ...frame,
    width: Math.min(viewport.width - frame.x - windowGap, frame.width + dx),
    height: Math.min(viewport.height - frame.y - windowGap, frame.height + dy),
  }, viewport);
}
