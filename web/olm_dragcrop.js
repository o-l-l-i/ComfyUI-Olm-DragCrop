import { app } from "../../scripts/app.js";
import { showConfirmDialog } from "./ui/confirmDialog.js";
import { handleDrawForeground } from "./core/render.js";

import { getWidget, hideWidget, applyBox } from "./utils/nodeUtils.js";

import {
  DEFAULT_SIZE,
  TEXTCONTENT,
  DEFAULT_SNAP_VALUE,
  colorOptions,
  DEFAULT_COLOR,
  WIDGET_ROW_H,
} from "./constants.js";

import {
  computeNodeSize,
  getPreviewAreaCached,
  handleResize,
} from "./ui/nodeLayout.js";

import {
  clampCropValues,
  resetCrop,
  syncCropWidgetsFromProperties,
  updateBoxFromCropValues,
} from "./core/cropModel.js";

import { getRatioFromCurrentCrop } from "./core/aspectSnap.js";

import { commitState } from "./core/commitState.js";

import { handleOnExecuted } from "./handlers/onExecutedHandler.js";
import { handleOnAdded } from "./handlers/onAddedHandler.js";
import { handleOnConfigure } from "./handlers/onConfigureHandler.js";

app.registerExtension({
  name: "olm.dragcrop",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name !== "OlmDragCrop") return;

    function initNodeState(node) {
      node.serialize_widgets = true;
      node.properties = node.properties || {};

      const defaults = {
        dragStart: null,
        dragEnd: null,
        actualImageWidth: DEFAULT_SIZE,
        actualImageHeight: DEFAULT_SIZE,
        crop_left: 0,
        crop_right: 0,
        crop_top: 0,
        crop_bottom: 0,
        crop_width: DEFAULT_SIZE,
        crop_height: DEFAULT_SIZE,
        snapValue: DEFAULT_SNAP_VALUE,
        aspectRatioString: TEXTCONTENT.aspectStringMsg,
        aspectLockEnabled: false,
        infoDisplayEnabled: true,
      };

      for (const key in defaults) {
        if (node.properties[key] === undefined) {
          node.properties[key] = defaults[key];
        }
      }

      node.image = new Image();
      node.image.src = "";
      node.imageLoaded = false;
      node.dragging = false;
      node.dragStartPos = null;
      node.cachedWidth = null;
      node.cachedHeight = null;
      node.dragMode = null;
      node.originalDragStart = null;
      node.originalDragEnd = null;
      node.initialDragDir = [0, 0];
      node.newCropInitialized = false;
    }

    function hideInternalWidgets(node) {
      const drawing_version_widget = getWidget(node, "drawing_version");
      hideWidget(drawing_version_widget, 0);

      const last_width_widget = getWidget(node, "last_width");
      hideWidget(last_width_widget, -4);

      const last_height_widget = getWidget(node, "last_height");
      hideWidget(last_height_widget, -4);

      const crop_width_widget = getWidget(node, "crop_width");
      hideWidget(crop_width_widget, -4);

      const crop_height_widget = getWidget(node, "crop_height");
      hideWidget(crop_height_widget, -4);
    }

    function createWidgets(node) {
      node.addWidget(
        "combo",
        TEXTCONTENT.snapToWidget,
        "none",
        (value) => {
          node.properties.snapValue = value;
          commitState(node);
        },
        {
          values: ["none", "2", "4", "8", "16", "32", "64"],
        }
      );

      node.addWidget(
        "string",
        TEXTCONTENT.aspectRatioWidget,
        node.properties.aspectRatioString,
        (value) => {
          node.properties.aspectRatioString = value;
          commitState(node);
        }
      );

      node.addWidget(
        "toggle",
        TEXTCONTENT.aspectRatioLockWidget,
        node.properties.aspectLockEnabled,
        (value) => {
          node.properties.aspectLockEnabled = value;
          commitState(node);
        }
      );

      node.addWidget(
        "button",
        TEXTCONTENT.setRatioFromCropWidget,
        "set_ratio",
        () => {
          const message = TEXTCONTENT.setRatiofromCropDlg;
          node.showConfirmDialog(message, () => {
            const aspectRatio = getRatioFromCurrentCrop(
              node.properties.dragStart,
              node.properties.dragEnd
            );
            const ratioWidget = getWidget(node, "Aspect Ratio");
            if (ratioWidget && aspectRatio !== null) {
              ratioWidget.value = aspectRatio;
              node.properties.aspectRatioString = aspectRatio;
              commitState(node);
            }
            node.setDirtyCanvas(true);
          });
        }
      );

      const crop_left = getWidget(node, "crop_left");
      crop_left.callback = (value) => {
        node.properties.crop_left = value;
        const preview = getPreviewAreaCached(node);
        node.setCropAndUpdate("left", preview);
        commitState(node);
        node.setDirtyCanvas(true);
      };

      const crop_right = getWidget(node, "crop_right");
      crop_right.callback = (value) => {
        node.properties.crop_right = value;
        const preview = getPreviewAreaCached(node);
        node.setCropAndUpdate("right", preview);
        commitState(node);
        node.setDirtyCanvas(true);
      };

      const crop_top = getWidget(node, "crop_top");
      crop_top.callback = (value) => {
        node.properties.crop_top = value;
        const preview = getPreviewAreaCached(node);
        node.setCropAndUpdate("top", preview);
        commitState(node);
        node.setDirtyCanvas(true);
      };

      const crop_bottom = getWidget(node, "crop_bottom");
      crop_bottom.callback = (value) => {
        node.properties.crop_bottom = value;
        const preview = getPreviewAreaCached(node);
        node.setCropAndUpdate("bottom", preview);
        commitState(node);
        node.setDirtyCanvas(true);
      };

      node.addWidget(
        "button",
        TEXTCONTENT.forceRefreshWidget,
        "refresh",
        () => {
          node.forceUpdate();
          commitState(node);
          node.setDirtyCanvas(true);
        }
      );

      node.infoToggle = node.addWidget(
        "button",
        node.getInfoToggleLabel(),
        null,
        () => {
          node.properties.infoDisplayEnabled =
            !node.properties.infoDisplayEnabled;
          node.updateInfoToggleLabel();
          commitState(node);
          node.setDirtyCanvas(true);
        }
      );

      const colorNames = colorOptions.map((o) => o.name);
      const defaultColor = colorOptions.find((o) => o.name === DEFAULT_COLOR);
      node.properties.box_color = defaultColor?.value || "#d5ff6b";

      node.addWidget(
        "combo",
        TEXTCONTENT.boxColorWidget,
        defaultColor?.name || DEFAULT_COLOR,
        (value) => {
          const selected = colorOptions.find((o) => o.name === value);
          if (selected) {
            node.properties.box_color = selected.value;
            commitState(node);
            node.setDirtyCanvas(true);
          }
        },
        { values: colorNames }
      );

      node.addWidget("button", TEXTCONTENT.resetCropWidget, "reset", () => {
        const message = TEXTCONTENT.resetCropDlg;
        node.showConfirmDialog(message, () => {
          const preview = getPreviewAreaCached(node);
          resetCrop(node, preview);
          commitState(node);
          const cropCtx = getCropCtx(node);
          applyBox(node, updateBoxFromCropValues(cropCtx, preview));
          node.setDirtyCanvas(true);
        });
      });
    }

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const node = this;

      onNodeCreated?.apply(node, arguments);

      initNodeState(node);

      hideInternalWidgets(node);

      createWidgets(node);

      node.size = node.computeSize();

      const preview = getPreviewAreaCached(node);
      resetCrop(node, preview);
      commitState(node);
      node.setDirtyCanvas(true);
    };

    nodeType.prototype.showConfirmDialog = function (message, callback) {
      showConfirmDialog(message, (confirmed) => {
        if (confirmed) callback();
      });
    };

    nodeType.prototype.getInfoToggleLabel = function () {
      const node = this;
      return node.properties.infoDisplayEnabled
        ? TEXTCONTENT.infoTextToggleWidgetHide
        : TEXTCONTENT.infoTextToggleWidgetShow;
    };

    nodeType.prototype.updateInfoToggleLabel = function () {
      const node = this;
      if (node.infoToggle) node.infoToggle.name = node.getInfoToggleLabel();
    };

    nodeType.prototype.forceUpdate = function () {
      const node = this;
      const drawing_version_widget = getWidget(node, "drawing_version");
      if (drawing_version_widget) {
        drawing_version_widget.value = Date.now();
      }
    };

    nodeType.prototype.setCropAndUpdate = function (changedSide, preview) {
      const node = this;
      const base = getCropCtx(node);

      const clamped = clampCropValues(base, changedSide);
      if (clamped) Object.assign(node.properties, clamped);

      syncCropWidgetsFromProperties(node);

      const boxPatch = updateBoxFromCropValues(
        {
          actualImageWidth: node.properties.actualImageWidth,
          actualImageHeight: node.properties.actualImageHeight,
          crop_left: clamped.crop_left,
          crop_right: clamped.crop_right,
          crop_top: clamped.crop_top,
          crop_bottom: clamped.crop_bottom,
        },
        preview
      );
      if (boxPatch) Object.assign(node.properties, boxPatch);
    };

    nodeType.prototype.onConfigure = function (o) {
      const node = this;
      handleOnConfigure(node);
    };

    nodeType.prototype.onAdded = function () {
      const node = this;
      handleOnAdded(node);
    };

    nodeType.prototype.onExecuted = function (message) {
      const node = this;
      handleOnExecuted(node, message);
    };

    nodeType.prototype.onConnectionsChange = function (
      type,
      index,
      connected,
      link_info
    ) {
      const node = this;
      if (type === LiteGraph.INPUT && link_info?.type === "IMAGE") {
        node.setDirtyCanvas(true);
      }
    };

    nodeType.prototype.computeSize = function () {
      const node = this;
      const widgetHeight = getWidgetHeight(node);
      const nodeCtx = {
        actualImageWidth: node.properties.actualImageWidth,
        actualImageHeight: node.properties.actualImageHeight,
        widgetHeight: widgetHeight,
      };

      const sizeData = computeNodeSize(nodeCtx);
      return sizeData.newSize;
    };

    nodeType.prototype.onResize = function (size) {
      const node = this;

      if (
        !node.properties.actualImageWidth ||
        !node.properties.actualImageHeight ||
        !size
      ) {
        return;
      }

      const resizeCtx = {
        size,
        actualImageWidth: node.properties.actualImageWidth,
        actualImageHeight: node.properties.actualImageHeight,
        widgetHeight: getWidgetHeight(node),
      };

      const newSize = handleResize(resizeCtx);
      node.size = newSize;

      const cropCtx = getCropCtx(node);
      const preview = getPreviewAreaCached(node);
      applyBox(node, updateBoxFromCropValues(cropCtx, preview));

      node.setDirtyCanvas(true);
    };

    nodeType.prototype.onDrawForeground = function (ctx) {
      const node = this;
      if (node.flags.collapsed) return;

      const preview = getPreviewAreaCached(node);
      const widgetHeight = getWidgetHeight(node);

      handleDrawForeground(node, ctx, widgetHeight, preview);
    };

    const getWidgetHeight = (node) => {
      return (
        (node.widgets?.filter((w) => !w.hidden) || []).length * WIDGET_ROW_H
      );
    };

    const getCropCtx = (node) => ({
      actualImageWidth: node.properties.actualImageWidth,
      actualImageHeight: node.properties.actualImageHeight,
      crop_left: node.properties.crop_left,
      crop_right: node.properties.crop_right,
      crop_top: node.properties.crop_top,
      crop_bottom: node.properties.crop_bottom,
    });
  },
});
