import test from 'node:test';
import assert from 'node:assert/strict';
import { bottomOf, boxOf, pointOf } from '../../src/geometry.ts';

const rotation = (degrees, scaleX = 1, scaleY = scaleX) => {
  const radians = degrees * Math.PI / 180;
  return {
    a: scaleX * Math.cos(radians),
    b: scaleX * Math.sin(radians),
    c: -scaleY * Math.sin(radians),
    d: scaleY * Math.cos(radians),
  };
};

/* The upright rectangle around a box of this size turned by this angle,
   centred on (cx, cy): what getBoundingClientRect returns for it. */
const boundsOf = (width, height, degrees, cx = 300, cy = 500) => {
  const radians = Math.abs(degrees) * Math.PI / 180;
  const w = width * Math.cos(radians) + height * Math.sin(radians);
  const h = width * Math.sin(radians) + height * Math.cos(radians);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
};

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} ≠ ${expected}`);

// MARK: - Boxes

test('an element without a transform keeps its bounding rectangle', () => {
  const bounds = { x: 10, y: 20, w: 300, h: 40 };

  assert.deepEqual(boxOf(bounds, null, { width: 300, height: 40 }), { ...bounds, angle: 0 });
});

test('a turned phone gets its own size and angle, not the rectangle around it', () => {
  const bounds = boundsOf(196, 401, 8);
  assert.equal(Math.round(bounds.w), 250);
  assert.equal(Math.round(bounds.h), 424);

  const box = boxOf(bounds, rotation(8), { width: 196, height: 401 });

  close(box.w, 196, 'width');
  close(box.h, 401, 'height');
  close(box.angle, 8, 'angle');
  close(box.x + box.w / 2, 300, 'centre x');
  close(box.y + box.h / 2, 500, 'centre y');
});

test('a counter-clockwise turn keeps its sign', () => {
  const box = boxOf(boundsOf(196, 401, -8), rotation(-8), { width: 196, height: 401 });

  close(box.angle, -8, 'angle');
  close(box.w, 196, 'width');
});

test('a scale on top of the turn scales each side', () => {
  const box = boxOf(boundsOf(300, 150, 30), rotation(30, 1.5, 0.5), { width: 200, height: 300 });

  close(box.w, 300, 'width');
  close(box.h, 150, 'height');
  close(box.angle, 30, 'angle');
});

test('a turn under half a degree is drawn upright', () => {
  const bounds = { x: 0, y: 0, w: 100, h: 50 };

  assert.deepEqual(boxOf(bounds, rotation(0.4), { width: 100, height: 50 }), { ...bounds, angle: 0 });
});

test('an element without a layout size, such as an SVG shape, stays upright', () => {
  const bounds = { x: 0, y: 0, w: 120, h: 80 };

  assert.deepEqual(boxOf(bounds, rotation(20), null), { ...bounds, angle: 0 });
});

// MARK: - Points

test('upright, the corners are the rectangle\'s', () => {
  const box = { x: 10, y: 20, w: 100, h: 50, angle: 0 };

  assert.deepEqual(pointOf(box, 0, 0), [10, 20]);
  assert.deepEqual(pointOf(box, 1, 1), [110, 70]);
  assert.deepEqual(pointOf(box, 0.5, 0.5), [60, 45]);
  assert.equal(bottomOf(box), 70);
});

test('turned a quarter, the top-left corner moves to the top right', () => {
  const box = { x: 0, y: 0, w: 100, h: 50, angle: 90 };
  const [x, y] = pointOf(box, 0, 0);

  close(x, 75, 'x');
  close(y, -25, 'y');
});

test('the corners of a turned box span the rectangle it was measured from', () => {
  const bounds = boundsOf(196, 401, 8);
  const box = boxOf(bounds, rotation(8), { width: 196, height: 401 });
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => pointOf(box, u, v));

  close(Math.min(...corners.map(([x]) => x)), bounds.x, 'left');
  close(Math.max(...corners.map(([x]) => x)), bounds.x + bounds.w, 'right');
  close(Math.min(...corners.map(([, y]) => y)), bounds.y, 'top');
  close(bottomOf(box), bounds.y + bounds.h, 'bottom');
});
