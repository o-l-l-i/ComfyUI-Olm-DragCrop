import { ColorUtils } from "../utils/colorUtils.js";
import { MathUtils } from "../utils/mathUtils.js";
import { GRAPHICS, TEXT, TEXTCONTENT } from "../constants.js";

export function drawCropBox(
  ctx,
  nodeCtx,
  box_color,
  infoDisplayEnabled,
  previewArea,
  clippedX,
  clippedY,
  clippedW,
  clippedH
) {
  ctx.save();
  ctx.fillStyle = GRAPHICS.croppedDarken;
  ctx.beginPath();
  ctx.rect(previewArea.x, previewArea.y, previewArea.width, previewArea.height);
  ctx.rect(clippedX, clippedY, clippedW, clippedH);
  ctx.fill("evenodd");

  ctx.strokeStyle = box_color;
  ctx.lineWidth = GRAPHICS.cropLineWidth;
  ctx.strokeRect(clippedX, clippedY, clippedW, clippedH);

  ctx.fillStyle = box_color;
  ctx.font = TEXT.cropBoxFont;
  ctx.textAlign = "center";

  const cropDisplayValues = updateCropDisplayValues(nodeCtx, { round: true });

  if (infoDisplayEnabled && cropDisplayValues) {
    ctx.fillText(
      `${cropDisplayValues.percentWidth} × ${cropDisplayValues.percentHeight} %`,
      clippedX + clippedW / 2,
      clippedY + clippedH / 2 + 6
    );
    ctx.fillText(
      `${cropDisplayValues.width} × ${cropDisplayValues.height} px`,
      clippedX + clippedW / 2,
      clippedY + clippedH / 2 + 20
    );
  }

  const handleSize = GRAPHICS.handleSize;
  const half = handleSize / 2;
  const handlePositions = [
    [clippedX, clippedY],
    [clippedX + clippedW, clippedY],
    [clippedX, clippedY + clippedH],
    [clippedX + clippedW, clippedY + clippedH],
  ];

  ctx.fillStyle = ColorUtils.darken(box_color, GRAPHICS.darkenFactor);
  ctx.strokeStyle = box_color;
  ctx.lineWidth = GRAPHICS.handleLineWidth;

  handlePositions.forEach(([hx, hy]) => {
    ctx.beginPath();
    ctx.rect(hx - half, hy - half, handleSize, handleSize);
    ctx.fill();
    ctx.stroke();
  });

  const edgePositions = [
    [clippedX + clippedW / 2, clippedY],
    [clippedX + clippedW / 2, clippedY + clippedH],
    [clippedX, clippedY + clippedH / 2],
    [clippedX + clippedW, clippedY + clippedH / 2],
  ];

  ctx.fillStyle = ColorUtils.darken(box_color, GRAPHICS.darkenFactor);
  edgePositions.forEach(([hx, hy]) => {
    ctx.beginPath();
    ctx.rect(hx - half, hy - half, handleSize, handleSize);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

function drawPreviewBorder(ctx, preview) {
  ctx.save();
  ctx.strokeStyle = GRAPHICS.border;
  ctx.lineWidth = GRAPHICS.borderLineWidth;
  ctx.strokeRect(preview.x, preview.y, preview.width, preview.height);
  ctx.restore();
}

function drawSource(ctx, node, preview) {
  ctx.save();
  if (node.imageLoaded) {
    ctx.drawImage(
      node.image,
      preview.x,
      preview.y,
      preview.width,
      preview.height
    );
  } else {
    ctx.fillStyle = GRAPHICS.colorDimFill;
    ctx.fillRect(preview.x, preview.y, preview.width, preview.height);
    ctx.fillStyle = TEXT.colorDimText;
    ctx.font = TEXT.fontMessage;
    ctx.textAlign = "center";
    ctx.fillText(
      TEXTCONTENT.imageAreaInfoMsgRow1,
      preview.x + preview.width / 2,
      preview.y + preview.height / 2 - 20
    );
    ctx.fillText(
      TEXTCONTENT.imageAreaInfoMsgRow2,
      preview.x + preview.width / 2,
      preview.y + preview.height / 2 + 40
    );
  }
  ctx.restore();
}

function drawCropIfAny(ctx, node, nodeCtx, preview) {
  if (!node.properties.dragStart || !node.properties.dragEnd) return;

  const dragCtx = {
    dragStart: node.properties.dragStart,
    dragEnd: node.properties.dragEnd,
    actualImageWidth: node.properties.actualImageWidth,
    actualImageHeight: node.properties.actualImageHeight,
  };
  const crop = getClippedCropBox(dragCtx, preview);
  if (!crop || crop.clippedW <= 0 || crop.clippedH <= 0) return;

  drawCropBox(
    ctx,
    nodeCtx,
    node.properties.box_color,
    node.properties.infoDisplayEnabled,
    preview,
    crop.clippedX,
    crop.clippedY,
    crop.clippedW,
    crop.clippedH
  );
}

function drawCropInfo(ctx, node, nodeCtx, offsetY) {
  const baseline = offsetY;
  const lineGap = 14;

  ctx.save();
  ctx.fillStyle = GRAPHICS.colorDim;
  ctx.font = TEXT.fontSmall;
  ctx.textAlign = "left";

  const srcW = nodeCtx.actualImageWidth || 0;
  const srcH = nodeCtx.actualImageHeight || 0;
  const srcARdec = srcH ? srcW / srcH : 1;
  const srcARtxt =
    node.image.src && node.image.complete
      ? MathUtils.decimalToRatio(srcARdec)
      : "";

  ctx.fillText(
    `Source: ${srcW}×${srcH}  AR: ${srcARdec.toFixed(2)}:1 ${
      srcARtxt ? `(${srcARtxt})` : ""
    }`,
    20,
    baseline
  );

  const disp = updateCropDisplayValues(nodeCtx, { round: true });
  const crARdec = disp.height ? disp.width / disp.height : 1;
  const crARtxt =
    node.image.src && node.image.complete
      ? MathUtils.decimalToRatio(crARdec)
      : "";

  ctx.fillText(
    `Crop: L ${disp.left}  R ${disp.right}  T ${disp.top}  B ${disp.bottom}`,
    20,
    baseline + lineGap
  );
  ctx.fillText(
    `Target: ${disp.width}×${disp.height}  AR: ${crARdec.toFixed(2)}:1 ${
      crARtxt ? `(${crARtxt})` : ""
    }`,
    20,
    baseline + lineGap * 2
  );

  ctx.restore();
}

function drawInstruction(ctx, node) {
  ctx.save();
  ctx.fillStyle = TEXT.colorFontSmall;
  ctx.font = TEXT.fontSmall;
  ctx.textAlign = "center";
  ctx.fillText(
    TEXTCONTENT.usageInstructionMsg,
    node.size[0] / 2,
    node.size[1] - 10
  );
  ctx.restore();
}

export function handleDrawForeground(node, ctx, widgetHeight, preview) {
  const nodeCtx = {
    crop_left: node.properties.crop_left,
    crop_right: node.properties.crop_right,
    crop_top: node.properties.crop_top,
    crop_bottom: node.properties.crop_bottom,
    crop_width: node.properties.crop_width,
    crop_height: node.properties.crop_height,
    actualImageWidth: node.properties.actualImageWidth,
    actualImageHeight: node.properties.actualImageHeight,
  };

  drawPreviewBorder(ctx, preview);
  drawCropInfo(ctx, node, nodeCtx, widgetHeight + 50);
  drawSource(ctx, node, preview);
  drawCropIfAny(ctx, node, nodeCtx, preview);
  drawInstruction(ctx, node);
}

function updateCropDisplayValues(nodeCtx, { round = false }) {
  let left = nodeCtx.crop_left || 0;
  let right = nodeCtx.crop_right || 0;
  let top = nodeCtx.crop_top || 0;
  let bottom = nodeCtx.crop_bottom || 0;
  let width = nodeCtx.crop_width || 0;
  let height = nodeCtx.crop_height || 0;
  let percentWidth = (width / nodeCtx.actualImageWidth) * 100.0;
  let percentHeight = (height / nodeCtx.actualImageHeight) * 100.0;

  if (round) {
    left = Math.round(left);
    right = Math.round(right);
    top = Math.round(top);
    bottom = Math.round(bottom);
    width = Math.round(width);
    height = Math.round(height);
    percentWidth = Math.round(percentWidth);
    percentHeight = Math.round(percentHeight);
  }

  const cropDisplayValues = {
    left,
    right,
    top,
    bottom,
    width,
    height,
    percentWidth,
    percentHeight,
  };

  return { ...cropDisplayValues };
}

function getClippedCropBox(dragCtx, preview) {
  if (
    !dragCtx.dragStart ||
    !dragCtx.dragEnd ||
    !dragCtx.actualImageWidth ||
    !dragCtx.actualImageHeight
  ) {
    return null;
  }

  const cropX = Math.min(dragCtx.dragStart[0], dragCtx.dragEnd[0]) + preview.x;
  const cropY = Math.min(dragCtx.dragStart[1], dragCtx.dragEnd[1]) + preview.y;
  const cropW = Math.abs(dragCtx.dragStart[0] - dragCtx.dragEnd[0]);
  const cropH = Math.abs(dragCtx.dragStart[1] - dragCtx.dragEnd[1]);

  const minSize = 1;
  const finalCropW = Math.max(cropW, minSize);
  const finalCropH = Math.max(cropH, minSize);

  const clippedX = Math.max(cropX, preview.x);
  const clippedY = Math.max(cropY, preview.y);

  const maxW = preview.x + preview.width - clippedX;
  const maxH = preview.y + preview.height - clippedY;

  const clippedW = Math.min(finalCropW, Math.max(maxW, 0));
  const clippedH = Math.min(finalCropH, Math.max(maxH, 0));

  const pixelW = (clippedW / preview.width) * dragCtx.actualImageWidth;
  const pixelH = (clippedH / preview.height) * dragCtx.actualImageHeight;

  return { clippedX, clippedY, clippedW, clippedH, pixelW, pixelH };
}
