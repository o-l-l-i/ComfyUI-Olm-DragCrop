import { _applySnapToDragBox } from "./aspectSnap.js";
import { commitState } from "./commitState.js";

import { DEFAULT_SIZE, MIN_CROP_DIMENSION } from "../constants.js";

import { setWidgetValue } from "../utils/nodeUtils.js";

export function normalizeCropBox(dragStart, dragEnd) {
  const [x0, y0] = dragStart;
  const [x1, y1] = dragEnd;
  const minX = Math.min(x0, x1);
  const minY = Math.min(y0, y1);
  const maxX = Math.max(x0, x1);
  const maxY = Math.max(y0, y1);
  return { newStart: [minX, minY], newEnd: [maxX, maxY] };
}

export function clampCropValues(cropCtx, changedSide) {
  const w = cropCtx.actualImageWidth || DEFAULT_SIZE;
  const h = cropCtx.actualImageHeight || DEFAULT_SIZE;

  let l = cropCtx.crop_left || 0;
  let r = cropCtx.crop_right || 0;
  let t = cropCtx.crop_top || 0;
  let b = cropCtx.crop_bottom || 0;

  l = Math.max(0, l);
  r = Math.max(0, r);
  t = Math.max(0, t);
  b = Math.max(0, b);

  const maxCropX = w - MIN_CROP_DIMENSION;
  const maxCropY = h - MIN_CROP_DIMENSION;

  const totalX = l + r;
  if (totalX > maxCropX) {
    const overflow = totalX - maxCropX;
    if (changedSide === "left") {
      l = Math.max(0, l - overflow);
    } else if (changedSide === "right") {
      r = Math.max(0, r - overflow);
    } else {
      if (l >= r) l = Math.max(0, l - overflow);
      else r = Math.max(0, r - overflow);
    }
  }

  const totalY = t + b;
  if (totalY > maxCropY) {
    const overflow = totalY - maxCropY;
    if (changedSide === "top") {
      t = Math.max(0, t - overflow);
    } else if (changedSide === "bottom") {
      b = Math.max(0, b - overflow);
    } else {
      if (t >= b) t = Math.max(0, t - overflow);
      else b = Math.max(0, b - overflow);
    }
  }

  const result = {
    crop_left: l,
    crop_right: r,
    crop_top: t,
    crop_bottom: b,
    crop_width: Math.abs(w - l - r),
    crop_height: Math.abs(h - t - b),
  };

  return result;
}

export function updateBoxFromCropValues(cropCtx, preview) {
  const w = cropCtx.actualImageWidth;
  const h = cropCtx.actualImageHeight;
  if (!w || !h || w <= 0 || h <= 0) {
    console.warn(`[OlmDragCrop] Invalid image size.`);
    return;
  }

  if (!preview.width || !preview.height) {
    console.warn(`[OlmDragCrop] Invalid preview area.`);
    return;
  }

  const l = cropCtx.crop_left || 0;
  const r = cropCtx.crop_right || 0;
  const t = cropCtx.crop_top || 0;
  const b = cropCtx.crop_bottom || 0;

  const cropW = w - l - r;
  const cropH = h - t - b;
  if (cropW <= 0 || cropH <= 0) {
    console.warn(`[OlmDragCrop] Invalid crop size (${cropW}×${cropH})`);
    return;
  }

  const normX = l / w;
  const normY = t / h;
  const normW = cropW / w;
  const normH = cropH / h;

  const x = normX * preview.width;
  const y = normY * preview.height;
  const pxW = normW * preview.width;
  const pxH = normH * preview.height;

  return { dragStart: [x, y], dragEnd: [x + pxW, y + pxH] };
}

export function getCropBoxHitArea(dragStart, dragEnd, pos) {
  if (!dragStart || !dragEnd) {
    return null;
  }

  const localX = pos.x;
  const localY = pos.y;

  const x1 = dragStart[0];
  const y1 = dragStart[1];
  const x2 = dragEnd[0];
  const y2 = dragEnd[1];
  const cropX = Math.min(x1, x2);
  const cropY = Math.min(y1, y2);
  const cropW = Math.abs(x1 - x2);
  const cropH = Math.abs(y1 - y2);

  const minEdgeSize = 2;
  const maxEdgeSize = 6;
  const edgeSize = Math.max(
    minEdgeSize,
    Math.min(maxEdgeSize, Math.min(cropW, cropH) / 3)
  );

  const isVerySmall = cropW <= 12 || cropH <= 12;

  if (isVerySmall) {
    const tolerance = Math.max(3, edgeSize);

    const nearBox =
      localX >= cropX - tolerance &&
      localX <= cropX + cropW + tolerance &&
      localY >= cropY - tolerance &&
      localY <= cropY + cropH + tolerance;

    if (!nearBox) return null;

    const distToTopLeft = Math.sqrt(
      Math.pow(localX - cropX, 2) + Math.pow(localY - cropY, 2)
    );
    const distToTopRight = Math.sqrt(
      Math.pow(localX - (cropX + cropW), 2) + Math.pow(localY - cropY, 2)
    );
    const distToBottomLeft = Math.sqrt(
      Math.pow(localX - cropX, 2) + Math.pow(localY - (cropY + cropH), 2)
    );
    const distToBottomRight = Math.sqrt(
      Math.pow(localX - (cropX + cropW), 2) +
        Math.pow(localY - (cropY + cropH), 2)
    );

    const cornerTolerance = tolerance;

    if (distToTopLeft <= cornerTolerance) return "top-left";
    if (distToTopRight <= cornerTolerance) return "top-right";
    if (distToBottomLeft <= cornerTolerance) return "bottom-left";
    if (distToBottomRight <= cornerTolerance) return "bottom-right";

    const distToLeft = Math.abs(localX - cropX);
    const distToRight = Math.abs(localX - (cropX + cropW));
    const distToTop = Math.abs(localY - cropY);
    const distToBottom = Math.abs(localY - (cropY + cropH));

    const withinVertical =
      localY >= cropY - tolerance && localY <= cropY + cropH + tolerance;
    const withinHorizontal =
      localX >= cropX - tolerance && localX <= cropX + cropW + tolerance;

    if (distToLeft <= tolerance && withinVertical) return "left";
    if (distToRight <= tolerance && withinVertical) return "right";
    if (distToTop <= tolerance && withinHorizontal) return "top";
    if (distToBottom <= tolerance && withinHorizontal) return "bottom";

    if (
      localX >= cropX &&
      localX <= cropX + cropW &&
      localY >= cropY &&
      localY <= cropY + cropH
    ) {
      return "move";
    }

    return null;
  }

  const near = (a, b) => Math.abs(a - b) <= edgeSize;

  const nearLeft = near(localX, cropX);
  const nearRight = near(localX, cropX + cropW);
  const nearTop = near(localY, cropY);
  const nearBottom = near(localY, cropY + cropH);
  const insideHoriz = localX >= cropX && localX <= cropX + cropW;
  const insideVert = localY >= cropY && localY <= cropY + cropH;

  if (nearLeft && nearTop) return "top-left";
  if (nearRight && nearTop) return "top-right";
  if (nearLeft && nearBottom) return "bottom-left";
  if (nearRight && nearBottom) return "bottom-right";
  if (nearLeft && insideVert) return "left";
  if (nearRight && insideVert) return "right";
  if (nearTop && insideHoriz) return "top";
  if (nearBottom && insideHoriz) return "bottom";
  if (insideHoriz && insideVert) return "move";

  return null;
}

export function resetCropValues(imageWidth, imageHeight, preview) {
  if (!imageWidth || !imageHeight || !preview?.width || !preview?.height)
    return null;
  return {
    crop_left: 0,
    crop_right: 0,
    crop_top: 0,
    crop_bottom: 0,
    crop_width: imageWidth,
    crop_height: imageHeight,
    dragStart: [0, 0],
    dragEnd: [preview.width, preview.height],
  };
}

export function resetCrop(node, preview) {
  const patch = resetCropValues(
    node.properties.actualImageWidth,
    node.properties.actualImageHeight,
    preview
  );
  if (!patch) return null;
  Object.assign(node.properties, patch);
  return patch;
}

export function _finalizeCrop(node, preview) {
  if (
    node.properties.snapValue !== null &&
    node.properties.snapValue !== "none"
  ) {
    const nodeCtx = {
      dragStart: node.properties.dragStart,
      dragEnd: node.properties.dragEnd,
      actualImageWidth: node.properties.actualImageWidth,
      actualImageHeight: node.properties.actualImageHeight,
    };
    const { dragStart, dragEnd } = _applySnapToDragBox(
      nodeCtx,
      parseInt(node.properties.snapValue),
      preview
    );
    node.properties.dragStart = dragStart;
    node.properties.dragEnd = dragEnd;
  }

  updateCropValuesFromBox(node, preview);
  node.cachedWidth = null;
  node.cachedHeight = null;
  node.dragMode = null;
  node.dragStartPos = null;
  node.originalDragStart = null;
  node.originalDragEnd = null;
  commitState(node);
}

export function updateCropValuesFromBox(
  node,
  preview,
  updateProperties = true,
  updateWidgets = true,
  precision = 0
) {
  if (!node.properties.dragStart || !node.properties.dragEnd) {
    console.warn(`[OlmDragCrop] Node ${node.id}: Missing dragStart or dragEnd`);
    return null;
  }

  const patch = boxFromCropValues(
    node.properties.actualImageWidth,
    node.properties.actualImageHeight,
    node.properties.dragStart,
    node.properties.dragEnd,
    preview,
    { precision }
  );
  if (!patch) return null;

  if (updateProperties) Object.assign(node.properties, patch);

  if (updateWidgets) {
    for (const k of [
      "crop_left",
      "crop_right",
      "crop_top",
      "crop_bottom",
      "crop_width",
      "crop_height",
    ]) {
      setWidgetValue(node, k, updateProperties ? node.properties[k] : patch[k]);
    }
  }

  node.setDirtyCanvas(true);
  return patch;
}

export function boxFromCropValues(
  actualImageWidth,
  actualImageHeight,
  dragStart,
  dragEnd,
  preview,
  { precision = 0 } = {}
) {
  if (
    !preview?.width ||
    !preview?.height ||
    !actualImageWidth ||
    !actualImageHeight
  )
    return null;

  const startX = Math.max(0, Math.min(dragStart[0], dragEnd[0]));
  const startY = Math.max(0, Math.min(dragStart[1], dragEnd[1]));
  const endX = Math.min(preview.width, Math.max(dragStart[0], dragEnd[0]));
  const endY = Math.min(preview.height, Math.max(dragStart[1], dragEnd[1]));

  const scaleX = actualImageWidth / preview.width;
  const scaleY = actualImageHeight / preview.height;

  let crop_left = startX * scaleX;
  let crop_right = actualImageWidth - endX * scaleX;
  let crop_top = startY * scaleY;
  let crop_bottom = actualImageHeight - endY * scaleY;
  let crop_width = actualImageWidth - crop_left - crop_right;
  let crop_height = actualImageHeight - crop_top - crop_bottom;

  crop_left = Math.max(0, crop_left);
  crop_right = Math.max(0, crop_right);
  crop_top = Math.max(0, crop_top);
  crop_bottom = Math.max(0, crop_bottom);
  crop_width = Math.max(0, crop_width);
  crop_height = Math.max(0, crop_height);

  if (precision > 0) {
    const r = (v) => Math.round(v * 10 ** precision) / 10 ** precision;
    crop_left = r(crop_left);
    crop_right = r(crop_right);
    crop_top = r(crop_top);
    crop_bottom = r(crop_bottom);
    crop_width = r(crop_width);
    crop_height = r(crop_height);
  }

  return {
    crop_left,
    crop_right,
    crop_top,
    crop_bottom,
    crop_width,
    crop_height,
  };
}

export function syncCropWidgetsFromProperties(node) {
  if (!node.widgets) return;
  const cropMap = {
    crop_left: node.properties.crop_left,
    crop_right: node.properties.crop_right,
    crop_top: node.properties.crop_top,
    crop_bottom: node.properties.crop_bottom,
    crop_width: node.properties.crop_width,
    crop_height: node.properties.crop_height,
  };
  node.widgets.forEach((w) => {
    if (cropMap.hasOwnProperty(w.name)) {
      w.value = cropMap[w.name];
    }
  });
}
