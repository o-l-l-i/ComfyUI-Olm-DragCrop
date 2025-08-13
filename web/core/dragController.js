import { getLockedAspectRatio } from "./aspectSnap.js";
import { MIN_CROP_DIMENSION } from "../constants.js";

import {
  _finalizeCrop,
  getCropBoxHitArea,
  normalizeCropBox,
  updateCropValuesFromBox,
} from "./cropModel.js";

import {
  clamp,
  clampPointToRect,
  clonePoint,
  getBoxSize,
  isWithinBounds,
} from "../utils/geometryUtils.js";

import { applyBox } from "../utils/nodeUtils.js";

export function handleOnMouseDown(node, e, pos, graphCanvas, preview) {
  const mousePos = [e.canvasX, e.canvasY];
  let local = getPreviewLocalPos(node.pos, mousePos, preview);

  if (node.properties.dragStart && node.properties.dragEnd) {
    applyBox(
      node,
      normalizeCropBox(node.properties.dragStart, node.properties.dragEnd)
    );
  }

  const hit = getCropBoxHitArea(
    node.properties.dragStart,
    node.properties.dragEnd,
    local
  );
  if (hit) {
    node.dragging = true;
    node.dragMode = hit;
    node.dragStartPos = mousePos;
    node.originalDragStart = clonePoint(node.properties.dragStart);
    node.originalDragEnd = clonePoint(node.properties.dragEnd);

    [node.cachedWidth, node.cachedHeight] = getBoxSize(
      node.properties.dragStart,
      node.properties.dragEnd
    );

    updateCropValuesFromBox(node, preview);
    node.setDirtyCanvas(true);
    return true;
  }

  if (
    local.x > 0 &&
    local.y > 0 &&
    local.x < preview.width &&
    local.y < preview.height
  ) {
    node.dragging = true;
    node.dragMode = "new";
    node.newCropStart = [local.x, local.y];
    node.newCropInitialized = false;
    node.dragStartPos = mousePos;
    node.cachedWidth = null;
    node.cachedHeight = null;
    return true;
  }

  return false;
}

function getDragContext(node, extras = {}) {
  return {
    dragMode: node.dragMode,
    dragStart: node.properties.dragStart,
    dragEnd: node.properties.dragEnd,
    cachedWidth: node.cachedWidth,
    cachedHeight: node.cachedHeight,
    ...extras,
  };
}

export function handleOnMouseMove(node, e, pos, graphCanvas, preview) {
  if (!node.dragging || !node.properties.dragStart || !node.properties.dragEnd)
    return false;

  if (e.buttons !== 1) {
    handleOnMouseUp(node, e, pos, graphCanvas, preview);
    return false;
  }

  const mousePos = [e.canvasX, e.canvasY];
  const mousePosLocal = getPreviewLocalPos(node.pos, mousePos, preview);
  const lockedAspectRatio = node.properties.aspectLockEnabled
    ? getLockedAspectRatio(node.properties.aspectRatioString)
    : null;

  const scaleX = node.properties.actualImageWidth / preview.width;
  const scaleY = node.properties.actualImageHeight / preview.height;
  const minWidth = MIN_CROP_DIMENSION / scaleX;
  const minHeight = MIN_CROP_DIMENSION / scaleY;

  const [clampedX, clampedY] = clampPointToRect(
    [mousePosLocal.x, mousePosLocal.y],
    preview.width,
    preview.height
  );
  mousePosLocal.x = clampedX;
  mousePosLocal.y = clampedY;

  const dragCtx = getDragContext(node, {
    nodePos: node.pos,
    originalDragStart: node.originalDragStart,
    originalDragEnd: node.originalDragEnd,
    dragStartPos: node.dragStartPos,
    aspectRatio: lockedAspectRatio,
    mousePosLocal,
    preview,
    minWidth,
    minHeight,
  });

  if (node.dragMode === "new") {
    handleNewDrag(node, dragCtx);
  } else if (node.dragMode === "move") {
    if (lockedAspectRatio) {
      applyBox(node, handleAspectRatioMove(dragCtx));
    } else {
      applyBox(node, handleEdgeOrMoveDrag(dragCtx));
    }
  } else if (lockedAspectRatio) {
    applyBox(node, handleAspectRatioDrag(dragCtx));
  } else {
    applyBox(node, handleEdgeOrMoveDrag(dragCtx));
  }

  updateCropValuesFromBox(node, preview);
  node.setDirtyCanvas(true);
  return true;
}

export function handleOnMouseUp(node, e, pos, graphCanvas, preview) {
  if (!node.dragging) return false;

  node.dragging = false;
  const dragCtx = getDragContext(node);
  applyBox(node, _restoreExactBoxDimensionsIfMoved(dragCtx));
  _finalizeCrop(node, preview);

  return true;
}

export function handleOnMouseLeave(node, e, preview) {
  if (node.dragging) {
    node.dragging = false;
    const dragCtx = getDragContext(node);
    applyBox(node, _restoreExactBoxDimensionsIfMoved(dragCtx));
    _finalizeCrop(node, preview);
  }
}

export function handleNewDrag(node, dragCtx) {
  const { mousePosLocal, preview, aspectRatio, minWidth, minHeight } = dragCtx;

  if (!node.newCropInitialized) {
    node.properties.dragStart = [mousePosLocal.x, mousePosLocal.y];
    node.properties.dragEnd = [mousePosLocal.x, mousePosLocal.y];
    node.initialDragDir = [0, 0];
    node.newCropInitialized = true;
  }

  const newDrag = newDragBoxVals({
    mousePosLocal,
    preview,
    aspectRatio,
    minWidth,
    minHeight,
    dragStart: node.properties.dragStart,
    initialDragDir: node.initialDragDir,
  });

  node.properties.dragEnd = newDrag.newEnd;
  node.initialDragDir = newDrag.initialDragDir;
}

export function newDragBoxVals(ctx) {
  const {
    mousePosLocal,
    preview,
    aspectRatio,
    minWidth,
    minHeight,
    dragStart,
    initialDragDir,
  } = ctx;

  const [startX, startY] = dragStart;
  const dx = mousePosLocal.x - startX;
  const dy = mousePosLocal.y - startY;

  let initDirX = initialDragDir?.[0] ?? 0;
  let initDirY = initialDragDir?.[1] ?? 0;
  if (initDirX === 0 && dx !== 0) initDirX = Math.sign(dx);
  if (initDirY === 0 && dy !== 0) initDirY = Math.sign(dy);

  let dirX = dx !== 0 ? Math.sign(dx) : initDirX;
  let dirY = dy !== 0 ? Math.sign(dy) : initDirY;

  let width = Math.abs(dx);
  let height = Math.abs(dy);

  if (aspectRatio) {
    if (width === 0 && height === 0) {
    } else if (height === 0) {
      height = width / aspectRatio;
    } else if (width === 0) {
      width = height * aspectRatio;
    } else {
      if (width / height > aspectRatio) {
        height = width / aspectRatio;
      } else {
        width = height * aspectRatio;
      }
    }

    const maxW = initDirX > 0 ? preview.width - startX : startX;
    const maxH = initDirY > 0 ? preview.height - startY : startY;

    width = Math.min(width, maxW);
    height = Math.min(height, maxH);

    width = Math.max(width, minWidth);
    height = Math.max(height, minHeight);

    if (width && height) {
      if (width / height > aspectRatio) height = width / aspectRatio;
      else width = height * aspectRatio;
    }
  } else {
    if (width < minWidth) {
      width = minWidth;
      if (dirX === 0) dirX = initDirX;
    }
    if (height < minHeight) {
      height = minHeight;
      if (dirY === 0) dirY = initDirY;
    }
  }

  return {
    newEnd: [startX + dirX * width, startY + dirY * height],
    initialDragDir: [initDirX, initDirY],
  };
}

export function handleAspectRatioMove(dragCtx) {
  const { mousePosLocal, preview, dragStart, dragEnd } = dragCtx;

  const width = dragEnd[0] - dragStart[0];
  const height = dragEnd[1] - dragStart[1];

  const centerOffset = [width / 2, height / 2];

  const proposedStart = [
    mousePosLocal.x - centerOffset[0],
    mousePosLocal.y - centerOffset[1],
  ];

  const clampedStartX = clamp(proposedStart[0], 0, preview.width - width);
  const clampedStartY = clamp(proposedStart[1], 0, preview.height - height);
  const clampedEndX = clampedStartX + width;
  const clampedEndY = clampedStartY + height;

  return {
    newStart: [clampedStartX, clampedStartY],
    newEnd: [clampedEndX, clampedEndY],
  };
}

export function handleAspectRatioCornerDrag(dragCtx) {
  const {
    mousePosLocal,
    preview,
    aspectRatio,
    minWidth,
    minHeight,
    dragMode,
    originalDragStart,
    originalDragEnd,
  } = dragCtx;

  const anchorMap = {
    "bottom-right": originalDragStart,
    "top-left": originalDragEnd,
    "top-right": [originalDragStart[0], originalDragEnd[1]],
    "bottom-left": [originalDragEnd[0], originalDragStart[1]],
  };
  const anchor = anchorMap[dragMode];
  const isRight = dragMode.includes("right");
  const isBottom = dragMode.includes("bottom");

  const maxW = isRight ? preview.width - anchor[0] : anchor[0];
  const maxH = isBottom ? preview.height - anchor[1] : anchor[1];

  let newWidth = Math.abs(mousePosLocal.x - anchor[0]);
  let newHeight = Math.abs(mousePosLocal.y - anchor[1]);

  if (newWidth / aspectRatio > newHeight) newHeight = newWidth / aspectRatio;
  else newWidth = newHeight * aspectRatio;

  newWidth = Math.min(newWidth, maxW);
  newHeight = Math.min(newHeight, maxH);
  if (newWidth === maxW) newHeight = newWidth / aspectRatio;
  if (newHeight === maxH) newWidth = newHeight * aspectRatio;

  newWidth = Math.max(newWidth, minWidth);
  newHeight = Math.max(newHeight, minHeight);

  const startX = isRight ? anchor[0] : anchor[0] - newWidth;
  const endX = isRight ? anchor[0] + newWidth : anchor[0];
  const startY = isBottom ? anchor[1] : anchor[1] - newHeight;
  const endY = isBottom ? anchor[1] + newHeight : anchor[1];

  return { newStart: [startX, startY], newEnd: [endX, endY] };
}

export function handleAspectRatioEdgeDrag(dragCtx) {
  const {
    mousePosLocal,
    preview,
    aspectRatio,
    minWidth,
    minHeight,
    dragStart,
    dragEnd,
    dragMode,
  } = dragCtx;

  let newStart = [0, 0];
  let newEnd = [0, 0];

  switch (dragMode) {
    case "left": {
      const maxX = dragEnd[0] - minWidth;
      const proposedX = clamp(mousePosLocal.x, 0, maxX);
      const width = dragEnd[0] - proposedX;
      let height = width / aspectRatio;

      if (dragEnd[1] - height < 0) {
        height = dragEnd[1];
      }

      const finalWidth = height * aspectRatio;
      if (finalWidth >= minWidth && height >= minHeight) {
        newStart = [dragEnd[0] - finalWidth, dragEnd[1] - height];
        newEnd = [...dragEnd];
      }
      break;
    }

    case "right": {
      const minX = dragStart[0] + minWidth;
      const proposedX = clamp(mousePosLocal.x, minX, preview.width);
      const width = proposedX - dragStart[0];
      let height = width / aspectRatio;

      if (dragStart[1] + height > preview.height) {
        height = preview.height - dragStart[1];
      }

      const finalWidth = height * aspectRatio;
      if (finalWidth >= minWidth && height >= minHeight) {
        newEnd = [dragStart[0] + finalWidth, dragStart[1] + height];
        newStart = [...dragStart];
      }
      break;
    }

    case "top": {
      const maxY = dragEnd[1] - minHeight;
      const proposedY = clamp(mousePosLocal.y, 0, maxY);
      const height = dragEnd[1] - proposedY;
      let width = height * aspectRatio;

      if (dragEnd[0] - width < 0) {
        width = dragEnd[0];
      }

      const finalHeight = width / aspectRatio;
      if (width >= minWidth && finalHeight >= minHeight) {
        newStart = [dragEnd[0] - width, dragEnd[1] - finalHeight];
        newEnd = [...dragEnd];
      }
      break;
    }

    case "bottom": {
      const minY = dragStart[1] + minHeight;
      const proposedY = clamp(mousePosLocal.y, minY, preview.height);
      const height = proposedY - dragStart[1];
      let width = height * aspectRatio;

      if (dragStart[0] + width > preview.width) {
        width = preview.width - dragStart[0];
      }

      const finalHeight = width / aspectRatio;
      if (width >= minWidth && finalHeight >= minHeight) {
        newEnd = [dragStart[0] + width, dragStart[1] + finalHeight];
        newStart = [...dragStart];
      }
      break;
    }
  }

  return { newStart: newStart, newEnd: newEnd };
}

export function handleAspectRatioDrag(dragCtx) {
  const { dragMode } = dragCtx;

  switch (dragMode) {
    case "top-left":
    case "top-right":
    case "bottom-left":
    case "bottom-right":
      return handleAspectRatioCornerDrag(dragCtx);

    case "left":
    case "right":
    case "top":
    case "bottom":
      return handleAspectRatioEdgeDrag(dragCtx);
  }

  return { newStart: [0, 0], newEnd: [0, 0] };
}

export function handleMoveDrag(dragCtx) {
  const {
    mousePosLocal,
    preview,
    dragStart,
    dragStartPos,
    originalDragStart,
    originalDragEnd,
    cachedWidth,
    cachedHeight,
    nodePos,
  } = dragCtx;

  const startLocal = getPreviewLocalPos(nodePos, dragStartPos, preview);

  const [dx, dy] = [
    mousePosLocal.x - startLocal.x,
    mousePosLocal.y - startLocal.y,
  ];

  const origMinX = Math.min(originalDragStart[0], originalDragEnd[0]);
  const origMinY = Math.min(originalDragStart[1], originalDragEnd[1]);

  const constrainedMinX = clamp(origMinX + dx, 0, preview.width - cachedWidth);
  const constrainedMinY = clamp(
    origMinY + dy,
    0,
    preview.height - cachedHeight
  );

  const newStart = [constrainedMinX, constrainedMinY];
  const newEnd = [
    constrainedMinX + cachedWidth,
    constrainedMinY + cachedHeight,
  ];

  return [newStart, newEnd];
}

export function handleEdgeDragBox(dragCtx) {
  const {
    mousePosLocal,
    preview,
    minWidth,
    minHeight,
    dragStart,
    dragEnd,
    dragMode,
  } = dragCtx;

  let newStart = clonePoint(dragStart);
  let newEnd = clonePoint(dragEnd);

  switch (dragMode) {
    case "left":
      newStart[0] = clamp(mousePosLocal.x, 0, dragEnd[0] - minWidth);
      break;
    case "right":
      newEnd[0] = clamp(
        mousePosLocal.x,
        dragStart[0] + minWidth,
        preview.width
      );
      break;
    case "top":
      newStart[1] = clamp(mousePosLocal.y, 0, dragEnd[1] - minHeight);
      break;
    case "bottom":
      newEnd[1] = clamp(
        mousePosLocal.y,
        dragStart[1] + minHeight,
        preview.height
      );
      break;
  }

  return [newStart, newEnd];
}

export function handleCornerDragBox(dragCtx) {
  const {
    mousePosLocal,
    preview,
    minWidth,
    minHeight,
    dragStart,
    dragEnd,
    dragMode,
  } = dragCtx;

  let newStart = clonePoint(dragStart);
  let newEnd = clonePoint(dragEnd);

  switch (dragMode) {
    case "top-left":
      newStart[0] = clamp(mousePosLocal.x, 0, dragEnd[0] - minWidth);
      newStart[1] = clamp(mousePosLocal.y, 0, dragEnd[1] - minHeight);
      break;
    case "top-right":
      newEnd[0] = clamp(
        mousePosLocal.x,
        dragStart[0] + minWidth,
        preview.width
      );
      newStart[1] = clamp(mousePosLocal.y, 0, dragEnd[1] - minHeight);
      break;
    case "bottom-left":
      newStart[0] = clamp(mousePosLocal.x, 0, dragEnd[0] - minWidth);
      newEnd[1] = clamp(
        mousePosLocal.y,
        dragStart[1] + minHeight,
        preview.height
      );
      break;
    case "bottom-right":
      newEnd[0] = clamp(
        mousePosLocal.x,
        dragStart[0] + minWidth,
        preview.width
      );
      newEnd[1] = clamp(
        mousePosLocal.y,
        dragStart[1] + minHeight,
        preview.height
      );
      break;
  }

  return [newStart, newEnd];
}

export function handleEdgeOrMoveDrag(dragCtx) {
  const { preview, dragMode, dragStart, dragEnd } = dragCtx;

  let newStart = clonePoint(dragStart);
  let newEnd = clonePoint(dragEnd);

  if (dragMode === "move") {
    [newStart, newEnd] = handleMoveDrag(dragCtx);
  } else if (["left", "right", "top", "bottom"].includes(dragMode)) {
    [newStart, newEnd] = handleEdgeDragBox(dragCtx);
  } else {
    [newStart, newEnd] = handleCornerDragBox(dragCtx);
  }

  if (isWithinBounds(newStart, newEnd, preview.width, preview.height)) {
    return { newStart: newStart, newEnd: newEnd };
  }

  return { newStart: [0, 0], newEnd: [0, 0] };
}

export function getPreviewLocalPos(nodePos, pos, preview) {
  return {
    x: pos[0] - nodePos[0] - preview.x,
    y: pos[1] - nodePos[1] - preview.y,
  };
}

export function _restoreExactBoxDimensionsIfMoved(dragCtx) {
  const { dragStart, dragEnd, cachedWidth, cachedHeight, dragMode } = dragCtx;
  const EPS = 1e-3;

  if (dragMode !== "move") {
    return null;
  }

  if (!Number.isFinite(cachedWidth) || !Number.isFinite(cachedHeight)) {
    return null;
  }

  const currW = Math.abs(dragEnd[0] - dragStart[0]);
  const currH = Math.abs(dragEnd[1] - dragStart[1]);

  if (
    Math.abs(currW - cachedWidth) <= EPS &&
    Math.abs(currH - cachedHeight) <= EPS
  ) {
    return null;
  }

  const minX = Math.min(dragStart[0], dragEnd[0]);
  const minY = Math.min(dragStart[1], dragEnd[1]);

  return {
    dragStart: [minX, minY],
    dragEnd: [minX + cachedWidth, minY + cachedHeight],
  };
}
