export function clamp(val, min, max) {
  return Math.max(min, Math.min(val, max));
}

export function clampPointToRect(pos, width, height) {
  return [clamp(pos[0], 0, width), clamp(pos[1], 0, height)];
}

export function isWithinBounds(start, end, width, height) {
  const [minX, minY] = [Math.min(start[0], end[0]), Math.min(start[1], end[1])];
  const [maxX, maxY] = [Math.max(start[0], end[0]), Math.max(start[1], end[1])];
  return minX >= 0 && minY >= 0 && maxX <= width && maxY <= height;
}

export function getBoxSize(start, end) {
  return [Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1])];
}

export function clonePoint(point) {
  return point.slice();
}
