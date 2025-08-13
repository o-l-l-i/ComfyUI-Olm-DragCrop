import { app } from "../../../scripts/app.js";
import { _applySnapToDragBox } from "../core/aspectSnap.js";
import { commitState } from "../core/commitState.js";

import {
  resetCrop,
  syncCropWidgetsFromProperties,
  updateBoxFromCropValues,
  updateCropValuesFromBox,
} from "../core/cropModel.js";
import { getPreviewAreaCached, computeNodeSize } from "../ui/nodeLayout.js";

import { getWidget } from "../utils/nodeUtils.js";

export function handleOnExecuted(node, message) {
  const backendCropData = message?.crop_info?.[0] || null;
  const backendShouldResetCrop = backendCropData?.reset_crop_ui || false;

  const imageInfo = message?.images_custom?.[0];
  if (!imageInfo) {
    node.image.src = "";
    node.properties.actualImageWidth = 0;
    node.properties.actualImageHeight = 0;
    node.setDirtyCanvas(true);
    return;
  }

  const imageUrl = app.api.apiURL(
    `/view?filename=${imageInfo.filename}&type=${imageInfo.type}&subfolder=${
      imageInfo.subfolder
    }&rand=${Date.now()}`
  );

  node.image.onload = () => {
    node.imageLoaded = true;
    const newWidth = node.image.naturalWidth;
    const newHeight = node.image.naturalHeight;

    const resolutionId = `${newWidth}x${newHeight}`;
    const lastResolution = node.properties.lastResolution || null;
    const resolutionChanged = lastResolution !== resolutionId;

    node.properties.actualImageWidth = newWidth;
    node.properties.actualImageHeight = newHeight;
    node.properties.lastResolution = resolutionId;

    const last_width_widget = getWidget(node, "last_width");
    if (last_width_widget) last_width_widget.value = newWidth;

    const last_height_widget = getWidget(node, "last_height");
    if (last_height_widget) last_height_widget.value = newHeight;

    let shouldRecomputeSize = resolutionChanged || backendShouldResetCrop;

    if (shouldRecomputeSize) {
      if (node.onResize) {
        node.onResize(node.size);
      }

      const newSize = node.computeSize();
      if (newSize && newSize[0] > 0 && newSize[1] > 0) {
        node.size = newSize;
      } else {
        console.warn(
          `[OlmDragCrop] Node ${node.id}: computeSize returned invalid size:`,
          newSize
        );
        const totalWidgetHeight = (node.widgets || [])
          .filter((w) => !w.hidden)
          .reduce(
            (sum, w) => sum + (w.computeSize ? w.computeSize()[1] : 30),
            0
          );

        const nodeCtx = {
          actualImageWidth: newWidth,
          actualImageHeight: newHeight,
          widgetHeight: totalWidgetHeight,
        };

        const { newSize: fallbackSize } = computeNodeSize(nodeCtx);
        node.size = fallbackSize;
      }
    }

    node._previewAreaCache = null;
    const preview = getPreviewAreaCached(node);

    if (backendShouldResetCrop || resolutionChanged) {
      resetCrop(node, preview);
    } else if (backendCropData) {
      node.properties.crop_left = backendCropData.left;
      node.properties.crop_right = backendCropData.right;
      node.properties.crop_top = backendCropData.top;
      node.properties.crop_bottom = backendCropData.bottom;
      syncCropWidgetsFromProperties(node);
    }

    const cropValues = {
      actualImageWidth: node.properties.actualImageWidth,
      actualImageHeight: node.properties.actualImageHeight,
      crop_left: node.properties.crop_left || 0,
      crop_right: node.properties.crop_right || 0,
      crop_top: node.properties.crop_top || 0,
      crop_bottom: node.properties.crop_bottom || 0,
    };

    const boxPatch = updateBoxFromCropValues(cropValues, preview);
    if (boxPatch) {
      node.properties.dragStart = boxPatch.dragStart;
      node.properties.dragEnd = boxPatch.dragEnd;
    } else {
      console.warn(
        `[OlmDragCrop] Node ${node.id}: Failed to update drag box from crop values`
      );
    }

    commitState(node);
    node.setDirtyCanvas(true);
  };

  node.image.onerror = () => {
    node.imageLoaded = false;
    console.warn("[OlmDragCrop] Image failed to load");
  };

  node.image.src = imageUrl;
  node.setDirtyCanvas(true);
}
