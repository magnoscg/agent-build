import type { Box } from './layers.ts';

/* An element's own rotation below this, in degrees, is drawn upright. */
const MIN_ANGLE = 0.5;

export interface Transform {
  a: number;
  b: number;
  c: number;
  d: number;
}

/* A rotated element does not fit its bounding rectangle, the upright one
   around it. Its box takes the element's own size and angle, centred on the
   same point, as a design tool selects something rotated. */
export function boxOf(bounds: Omit<Box, 'angle'>, transform: Transform | null,
  size: { width: number; height: number } | null): Box {
  const upright = { ...bounds, angle: 0 };
  if (!transform || !size) {
    return upright;
  }
  const angle = Math.atan2(transform.b, transform.a) * 180 / Math.PI;
  if (Math.abs(angle) < MIN_ANGLE) {
    return upright;
  }
  const w = size.width * Math.hypot(transform.a, transform.b);
  const h = size.height * Math.hypot(transform.c, transform.d);
  return { x: bounds.x + (bounds.w - w) / 2, y: bounds.y + (bounds.h - h) / 2, w, h, angle };
}

/* A point of the box, turned with it: (0, 0) is its top-left corner and
   (1, 1) its bottom-right one. */
export function pointOf(box: Box, u: number, v: number): [number, number] {
  const radians = box.angle * Math.PI / 180;
  const dx = (u - 0.5) * box.w;
  const dy = (v - 0.5) * box.h;
  return [
    box.x + box.w / 2 + dx * Math.cos(radians) - dy * Math.sin(radians),
    box.y + box.h / 2 + dx * Math.sin(radians) + dy * Math.cos(radians),
  ];
}

export function bottomOf(box: Box): number {
  return Math.max(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => pointOf(box, u, v)[1]));
}

/* Where an element is, in document coordinates. */
export function measure(element: Element): Box {
  const rect = element.getBoundingClientRect();
  const bounds = { x: rect.left + scrollX, y: rect.top + scrollY, w: rect.width, h: rect.height };
  if (!(element instanceof HTMLElement)) {
    return { ...bounds, angle: 0 };
  }
  const { transform } = getComputedStyle(element);
  const matrix = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform) : null;
  return boxOf(bounds, matrix, { width: element.offsetWidth, height: element.offsetHeight });
}
