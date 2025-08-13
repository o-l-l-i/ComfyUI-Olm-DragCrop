import { LAYOUT } from "../constants.js";

export function getPreviewAreaCached(node) {
  const snap = {
    nodeWidth: node.size?.[0] ?? 0,
    nodeHeight: node.size?.[1] ?? 0,
    imageWidth: node.properties.actualImageWidth,
    imageHeight: node.properties.actualImageHeight,
    visibleWidgetCount: (node.widgets?.filter((w) => !w.hidden) ?? []).length,
  };

  const key = JSON.stringify(snap);
  if (node._previewAreaCache?.key === key) return node._previewAreaCache.value;

  const area = computePreviewArea(snap);
  node._previewAreaCache = { key, value: area };
  return area;
}

export function computePreviewArea({
  nodeWidth,
  nodeHeight,
  imageWidth,
  imageHeight,
  visibleWidgetCount,
}) {
  const aspect = imageWidth && imageHeight ? imageWidth / imageHeight : 1;
  return previewRectForNodeSize(
    nodeWidth,
    nodeHeight,
    aspect,
    visibleWidgetCount
  );
}

export function handleResize({
  size,
  actualImageWidth,
  actualImageHeight,
  widgetHeight,
}) {
  const [newW] = size;
  const aspect =
    actualImageWidth && actualImageHeight
      ? actualImageWidth / actualImageHeight
      : 1;
  const visWidgets = Math.round((widgetHeight || 0) / LAYOUT.WIDGET_ROW_H);
  return nodeSizeForPreviewWidth(newW - LAYOUT.PADDING_X, aspect, visWidgets);
}

export function computeNodeSize(nodeCtx) {
  const { actualImageWidth: iw, actualImageHeight: ih, widgetHeight } = nodeCtx;

  if (!iw || !ih) {
    return {
      computedAspectRatio: 1,
      computedWidth: 330,
      computedHeight: 330,
      newSize: [330, 330],
    };
  }

  const aspect = iw / ih;
  const visWidgets = Math.round((widgetHeight || 0) / LAYOUT.WIDGET_ROW_H);

  let targetW = LAYOUT.DEFAULT_PREVIEW_W;

  const startPreviewW = Math.min(
    Math.max(LAYOUT.PREVIEW_MIN_W, targetW),
    LAYOUT.PREVIEW_MAX_W,
    iw
  );

  const newSize = nodeSizeForPreviewWidth(startPreviewW, aspect, visWidgets);
  return {
    computedAspectRatio: newSize[0] / newSize[1],
    computedWidth: newSize[0],
    computedHeight: newSize[1],
    newSize,
  };
}

export function nodeSizeForPreviewWidth(
  previewW,
  aspect,
  visWidgets,
  C = LAYOUT
) {
  const clampedW = Math.max(
    C.PREVIEW_MIN_W,
    Math.min(previewW, C.PREVIEW_MAX_W)
  );
  const previewH = clampedW / (aspect || 1);
  const widgetH = visWidgets * C.WIDGET_ROW_H;
  const nodeW = clampedW + C.PADDING_X;
  const nodeH =
    C.HEADER_H + previewH + C.PADDING_Y + widgetH + C.INSTRUCTIONS_H;
  return [nodeW, nodeH];
}

export function previewRectForNodeSize(
  nodeW,
  nodeH,
  aspect,
  visWidgets,
  C = LAYOUT
) {
  const innerW = Math.max(0, nodeW - C.PADDING_X);
  const widgetH = visWidgets * C.WIDGET_ROW_H;
  const innerH = Math.max(
    0,
    nodeH - (C.HEADER_H + C.PADDING_Y + widgetH + C.INSTRUCTIONS_H)
  );

  let w = innerW,
    h = innerW / (aspect || 1);
  if (h > innerH) {
    h = innerH;
    w = h * (aspect || 1);
  }

  const x = C.PADDING_X / 2 + (innerW - w) / 2;
  const y = C.HEADER_H + widgetH;

  return { x, y, width: w, height: h };
}
