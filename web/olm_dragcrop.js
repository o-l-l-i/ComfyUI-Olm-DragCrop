import { app } from "../../scripts/app.js";

const ColorUtils = {
  hexToRgb(hex) {
    if (!hex || typeof hex !== "string") return null;
    const sanitized = hex.replace("#", "");
    if (sanitized.length !== 6) return null;
    const bigint = parseInt(sanitized, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  },

  rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  },

  hexToRgbaString(hex, alpha = 1.0) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return "rgba(0,0,0,0)";
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  },

  darken(hex, amount = 30) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return "#000";
    const clamp = (v) => Math.max(0, Math.min(255, v));
    return this.rgbToHex(
      clamp(rgb.r - amount),
      clamp(rgb.g - amount),
      clamp(rgb.b - amount)
    );
  },
};

const MathUtils = {
  decimalToRatio(decimal) {
    if (
      !isFinite(decimal) ||
      isNaN(decimal) ||
      decimal <= 0 ||
      decimal < 0.1 ||
      decimal > 10
    ) {
      return "...";
    }

    const commonRatios = [
      { ratio: "9:16", decimal: 9 / 16, num: 9, den: 16 },
      { ratio: "2:3", decimal: 2 / 3, num: 2, den: 3 },
      { ratio: "9:21", decimal: 9 / 21, num: 3, den: 7 },
      { ratio: "1:4", decimal: 1 / 4, num: 1, den: 4 },
      { ratio: "1:3", decimal: 1 / 3, num: 1, den: 3 },
      { ratio: "1:2.44", decimal: 1 / 2.44, num: 25, den: 61 },
      { ratio: "1:2.39", decimal: 1 / 2.39, num: 100, den: 239 },
      { ratio: "1:2.37", decimal: 1 / 2.37, num: 100, den: 237 },
      { ratio: "1:2.35", decimal: 1 / 2.35, num: 20, den: 47 },
      { ratio: "1:2", decimal: 1 / 2, num: 1, den: 2 },
      { ratio: "1:1.9", decimal: 1 / 1.9, num: 10, den: 19 },
      { ratio: "1:1.85", decimal: 1 / 1.85, num: 20, den: 37 },
      { ratio: "4:5", decimal: 4 / 5, num: 4, den: 5 },
      { ratio: "3:5", decimal: 3 / 5, num: 3, den: 5 },
      { ratio: "1:1", decimal: 1.0, num: 1, den: 1 },
      { ratio: "5:4", decimal: 5 / 4, num: 5, den: 4 },
      { ratio: "4:3", decimal: 4 / 3, num: 4, den: 3 },
      { ratio: "3:2", decimal: 3 / 2, num: 3, den: 2 },
      { ratio: "5:3", decimal: 5 / 3, num: 5, den: 3 },
      { ratio: "16:9", decimal: 16 / 9, num: 16, den: 9 },
      { ratio: "1.85:1", decimal: 1.85, num: 37, den: 20 },
      { ratio: "1.9:1", decimal: 1.9, num: 19, den: 10 },
      { ratio: "2:1", decimal: 2.0, num: 2, den: 1 },
      { ratio: "2.35:1", decimal: 2.35, num: 47, den: 20 },
      { ratio: "2.37:1", decimal: 2.37, num: 237, den: 100 },
      { ratio: "2.39:1", decimal: 2.39, num: 239, den: 100 },
      { ratio: "21:9", decimal: 21 / 9, num: 7, den: 3 },
      { ratio: "2.44:1", decimal: 2.44, num: 61, den: 25 },
      { ratio: "3:1", decimal: 3.0, num: 3, den: 1 },
      { ratio: "4:1", decimal: 4.0, num: 4, den: 1 },
    ];

    const tolerance = 0.05;

    for (const { ratio, decimal: targetDecimal } of commonRatios) {
      if (Math.abs(decimal - targetDecimal) < tolerance) {
        return ratio;
      }
    }

    return "...";
  },
};

app.registerExtension({
  name: "olm.dragcrop",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name !== "OlmDragCrop") return;

    nodeType.prototype.getWidget = function (name) {
      return this.widgets.find((w) => w.name === name);
    };

    nodeType.prototype.getWidgetValue = function (name, fallback = null) {
      return this.widgets.find((w) => w.name === name)?.value || fallback;
    };

    nodeType.prototype.setWidgetValue = function (widgetName, val) {
      const widget = this.getWidget(widgetName);
      if (widget && val !== null && val !== undefined) {
        // Only use Math.round for numeric values
        if (typeof val === 'number') {
          widget.value = Math.round(val);
        } else {
          widget.value = val;
        }
      }
    };

    nodeType.prototype.getWidgetValSafe = function (name) {
      const widget = this.getWidget(name);
      return widget ? widget.value : null;
    };

    const DEFAULT_SIZE = 512;
    const HANDLE_SIZE = 4;
    const MIN_CROP_DIMENSION = 1;
    const ASPECT_STRING_MESSAGE = "Use values like 0.5 or 16:9";
    const DEFAULT_SNAP_VALUE = "none";

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, arguments);

      this.serialize_widgets = true;

      this.properties = this.properties || {};

      this.properties.dragStart = null;
      this.properties.dragEnd = null;
      this.properties.actualImageWidth = DEFAULT_SIZE;
      this.properties.actualImageHeight = DEFAULT_SIZE;

      this.properties.crop_left = 0;
      this.properties.crop_right = 0;
      this.properties.crop_top = 0;
      this.properties.crop_bottom = 0;
      this.properties.crop_width = DEFAULT_SIZE;
      this.properties.crop_height = DEFAULT_SIZE;

      this.properties.snapValue = DEFAULT_SNAP_VALUE;

      this.properties.aspectRatioString = ASPECT_STRING_MESSAGE;
      this.properties.aspectLockEnabled = false;

      this.properties.infoDisplayEnabled = true;

      this.properties.fixedSizeEnabled = false;
      this.properties.fixedSizePreset = "Custom";
      this.properties.fixedWidth = DEFAULT_SIZE;
      this.properties.fixedHeight = DEFAULT_SIZE;

      this.image = new Image();
      this.image.src = "";
      this.imageLoaded = false;

      this.dragging = false;

      this.dragStart = null;
      this.dragEnd = null;
      this.actualImageWidth = DEFAULT_SIZE;
      this.actualImageHeight = DEFAULT_SIZE;

      this.cropData_left = 0;
      this.cropData_right = 0;
      this.cropData_top = 0;
      this.cropData_bottom = 0;
      this.cropData_width = DEFAULT_SIZE;
      this.cropData_height = DEFAULT_SIZE;

      this.snapValue = DEFAULT_SNAP_VALUE;

      this.aspectRatioString = ASPECT_STRING_MESSAGE;
      this.aspectLockEnabled = false;

      this.infoDisplayEnabled = true;

      this.fixedSizeEnabled = false;
      this.fixedSizePreset = "Custom";
      this.fixedWidth = DEFAULT_SIZE;
      this.fixedHeight = DEFAULT_SIZE;

      const drawing_version_widget = this.getWidget("drawing_version");
      if (drawing_version_widget) {
        drawing_version_widget.hidden = true;
        drawing_version_widget.computeSize = function () {
          return [0, 0];
        };
      }

      const last_width_widget = this.getWidget("last_width");
      if (last_width_widget) {
        last_width_widget.hidden = true;
        last_width_widget.computeSize = function () {
          return [0, -4];
        };
      }

      const last_height_widget = this.getWidget("last_height");
      if (last_height_widget) {
        last_height_widget.hidden = true;
        last_height_widget.computeSize = function () {
          return [0, -4];
        };
      }

      const crop_width_widget = this.getWidget("crop_width");
      if (crop_width_widget) {
        crop_width_widget.hidden = true;
        crop_width_widget.computeSize = function () {
          return [0, -4];
        };
      }

      const crop_height_widget = this.getWidget("crop_height");
      if (crop_height_widget) {
        crop_height_widget.hidden = true;
        crop_height_widget.computeSize = function () {
          return [0, -4];
        };
      }

      // Hide fixed size widgets as we'll create custom UI elements
      const fixed_size_enabled_widget = this.getWidget("fixed_size_enabled");
      if (fixed_size_enabled_widget) {
        fixed_size_enabled_widget.hidden = true;
        fixed_size_enabled_widget.computeSize = function () {
          return [0, -4];
        };
      }

      const fixed_size_preset_widget = this.getWidget("fixed_size_preset");
      if (fixed_size_preset_widget) {
        fixed_size_preset_widget.hidden = true;
        fixed_size_preset_widget.computeSize = function () {
          return [0, -4];
        };
        // Ensure it has a valid default value
        if (!fixed_size_preset_widget.value || fixed_size_preset_widget.value === "None") {
          fixed_size_preset_widget.value = "Custom";
        }
      }

      const fixed_width_widget = this.getWidget("fixed_width");
      if (fixed_width_widget) {
        fixed_width_widget.hidden = true;
        fixed_width_widget.computeSize = function () {
          return [0, -4];
        };
      }

      const fixed_height_widget = this.getWidget("fixed_height");
      if (fixed_height_widget) {
        fixed_height_widget.hidden = true;
        fixed_height_widget.computeSize = function () {
          return [0, -4];
        };
      }

      this.addWidget(
        "combo",
        "Snap to",
        "none",
        (value) => {
          this.snapValue = value;
          this.commitState();
        },
        {
          values: ["none", "2", "4", "8", "16", "32", "64"],
        }
      );

      // Fixed size widgets
      this.fixedSizeToggleWidget = this.addWidget(
        "toggle",
        "Fixed Size Mode",
        this.fixedSizeEnabled,
        (value) => {
          this.fixedSizeEnabled = value;
          this.setWidgetValue("fixed_size_enabled", value);
          this.updateFixedSizeWidgets();
          this.applyFixedSizeToCurrentCrop();
          this.commitState();
        }
      );

      this.fixedSizePresetWidget = this.addWidget(
        "combo",
        "Size Preset",
        this.fixedSizePreset || "Custom",
        (value) => {
          this.fixedSizePreset = value;
          this.setWidgetValue("fixed_size_preset", value);
          this.updateFixedSizeFromPreset();
          this.updateFixedSizeWidgets(); // Update widget disabled states
          this.applyFixedSizeToCurrentCrop();
          this.commitState();
        },
        {
          values: ["Custom", "720x1280", "1280x720", "1024x1024", "512x512", "768x768", "1024x768", "768x1024", "1920x1080", "1080x1920", "1280x960", "960x1280", "640x480", "480x640"]
        }
      );
      
      // Ensure the hidden widget also has the correct value
      const hidden_preset_widget = this.getWidget("fixed_size_preset");
      if (hidden_preset_widget && (!hidden_preset_widget.value || hidden_preset_widget.value === "None")) {
        hidden_preset_widget.value = "Custom";
      }

      this.fixedWidthWidget = this.addWidget(
        "number",
        "Fixed Width",
        this.fixedWidth,
        (value) => {
          this.fixedWidth = Math.max(1, Math.min(8192, Math.round(value)));
          this.setWidgetValue("fixed_width", this.fixedWidth);
          this.fixedSizePreset = "Custom";
          this.fixedSizePresetWidget.value = "Custom";
          this.setWidgetValue("fixed_size_preset", "Custom");
          this.applyFixedSizeToCurrentCrop();
          this.commitState();
        },
        { min: 1, max: 8192, step: 1 }
      );

      this.fixedHeightWidget = this.addWidget(
        "number",
        "Fixed Height",
        this.fixedHeight,
        (value) => {
          this.fixedHeight = Math.max(1, Math.min(8192, Math.round(value)));
          this.setWidgetValue("fixed_height", this.fixedHeight);
          this.fixedSizePreset = "Custom";
          this.fixedSizePresetWidget.value = "Custom";
          this.setWidgetValue("fixed_size_preset", "Custom");
          this.applyFixedSizeToCurrentCrop();
          this.commitState();
        },
        { min: 1, max: 8192, step: 1 }
      );

      // Set initial disabled state for fixed size widgets
      this.fixedSizePresetWidget.disabled = !this.fixedSizeEnabled;
      this.fixedWidthWidget.disabled = !this.fixedSizeEnabled || this.fixedSizePreset !== "Custom";
      this.fixedHeightWidget.disabled = !this.fixedSizeEnabled || this.fixedSizePreset !== "Custom";

      const aspectRatioWidget = this.addWidget(
        "string",
        "Aspect Ratio",
        this.aspectRatioString,
        (value) => {
          this.aspectRatioString = value;
          this.commitState();
        }
      );

      const lockWidget = this.addWidget(
        "toggle",
        "Aspect Ratio Lock",
        this.aspectLockEnabled,
        (value) => {
          this.aspectLockEnabled = value;
          this.commitState();
        }
      );

      this.addWidget("button", "Set Ratio from Crop", "set_ratio", () => {
        const confirmed = window.confirm(
          "Use the current crop dimensions to set the aspect ratio?\nThis will overwrite any previously set ratio."
        );
        if (confirmed) {
          this.setRatioFromCurrentCrop();
          this.commitState();
        }
      });

      const crop_left = this.getWidget("crop_left");
      crop_left.callback = (value) => {
        this.cropData_left = value;
        this.setCropAndUpdate("left");
        this.commitState();
      };

      const crop_right = this.getWidget("crop_right");
      crop_right.callback = (value) => {
        this.cropData_right = value;
        this.setCropAndUpdate("right");
        this.commitState();
      };

      const crop_top = this.getWidget("crop_top");
      crop_top.callback = (value) => {
        this.cropData_top = value;
        this.setCropAndUpdate("top");
        this.commitState();
      };

      const crop_bottom = this.getWidget("crop_bottom");
      crop_bottom.callback = (value) => {
        this.cropData_bottom = value;
        this.setCropAndUpdate("bottom");
        this.commitState();
      };

      this.addWidget("button", "Force Refresh", "refresh", () => {
        this.forceUpdate();
        this.commitState();
      });

      this.infoToggle = this.addWidget(
        "button",
        this.getInfoToggleLabel(),
        null,
        () => {
          this.infoDisplayEnabled = !this.infoDisplayEnabled;
          this.updateInfoToggleLabel();
          this.commitState();
        }
      );

      const colorOptions = [
        { name: "Lime", value: "#d5ff6b" },
        { name: "Grey", value: "##999999" },
        { name: "White", value: "#ffffff" },
        { name: "Black", value: "#000000" },
        { name: "Red", value: "#ff3333" },
        { name: "Green", value: "#00ff00" },
        { name: "Blue", value: "#3399ff" },
        { name: "Yellow", value: "#ffff00" },
        { name: "Magenta", value: "#ff00ff" },
        { name: "Cyan", value: "#00ffff" },
        { name: "Hot pink", value: "#fa69af" },
      ];

      const colorNames = colorOptions.map((o) => o.name);
      const defaultColorValue = "#d5ff6b";

      const defaultColorName =
        colorOptions.find((o) => o.value === defaultColorValue)?.name ||
        "Green";

      if (!this.properties.box_color) {
        this.properties.box_color = defaultColorName;
      }

      const selectedOption = colorOptions.find(
        (o) => o.name === this.properties.box_color
      );
      this.box_color = selectedOption?.value || defaultColorValue;

      this.addWidget(
        "combo",
        "Box Color",
        this.properties.box_color,
        (value) => {
          const selected = colorOptions.find((o) => o.name === value);
          if (selected) {
            this.box_color = selected.value;
            this.properties.box_color = selected.name;
            this.setDirtyCanvas(true);
            this.commitState();
          }
        },
        { values: colorNames }
      );

      this.addWidget("button", "Reset Crop", "reset", () => {
        const confirmed = window.confirm(
          "Are you sure you want to reset the crop? This will discard your current framing."
        );
        if (confirmed) {
          this.resetCrop();
          this.commitState();
        }
      });

      this.size = this.computeSize();

      // Initialize fixed size widgets visibility
      this.updateFixedSizeWidgets();

      this.resetCrop();
      this.commitState();
      this.setDirtyCanvas(true);
    };

    nodeType.prototype.getInfoToggleLabel = function () {
      return this.infoDisplayEnabled ? "Hide Info Text" : "Show Info Text";
    };

    nodeType.prototype.updateInfoToggleLabel = function () {
      if (this.infoToggle) {
        this.infoToggle.name = this.getInfoToggleLabel();
      }
    };

    nodeType.prototype.getWidgetsHeight = function () {
      if (!this.widgets || this.widgets.length === 0) return 0;

      // Get the last widget's actual position and height
      const lastWidget = this.widgets[this.widgets.length - 1];
      
      // If the last widget has a y position set, use it
      if (lastWidget.y !== undefined) {
        // Get the widget's height
        let widgetHeight = 0;
        const nodeWidth = this.size ? this.size[0] : 400;
        
        if (lastWidget.computedHeight) {
          widgetHeight = lastWidget.computedHeight;
        } else if (lastWidget.computeSize) {
          widgetHeight = lastWidget.computeSize(nodeWidth)[1];
        } else {
          widgetHeight = LiteGraph.NODE_WIDGET_HEIGHT || 20;
        }
        
        // Return the bottom position of the last widget relative to the widget area start
        // The widget.y is relative to the node, so we need to subtract the header height
        return (lastWidget.y + widgetHeight) - 30; // 30 is header height
      }
      
      // Fallback: calculate based on widget count if positions aren't set
      let totalHeight = 0;
      const nodeWidth = this.size ? this.size[0] : 400;
      const widgetSpacing = 4;

      for (let i = 0; i < this.widgets.length; i++) {
        const widget = this.widgets[i];
        
        if (widget.computedHeight) {
          totalHeight += widget.computedHeight;
        } else if (widget.computeSize) {
          totalHeight += widget.computeSize(nodeWidth)[1];
        } else {
          totalHeight += LiteGraph.NODE_WIDGET_HEIGHT || 20;
        }
        
        if (i < this.widgets.length - 1) {
          totalHeight += widgetSpacing;
        }
      }

      return totalHeight + 10;
    };

    nodeType.prototype.updateFixedSizeWidgets = function () {
      if (this.fixedSizePresetWidget) {
        this.fixedSizePresetWidget.disabled = !this.fixedSizeEnabled;
      }
      if (this.fixedWidthWidget) {
        // Disable if fixed mode is off OR if a preset is selected (not Custom)
        this.fixedWidthWidget.disabled = !this.fixedSizeEnabled || this.fixedSizePreset !== "Custom";
      }
      if (this.fixedHeightWidget) {
        // Disable if fixed mode is off OR if a preset is selected (not Custom)
        this.fixedHeightWidget.disabled = !this.fixedSizeEnabled || this.fixedSizePreset !== "Custom";
      }
      // No need to recompute size since widgets are still visible
      this.setDirtyCanvas(true);
    };

    nodeType.prototype.updateFixedSizeFromPreset = function () {
      if (this.fixedSizePreset !== "Custom") {
        const parts = this.fixedSizePreset.split("x");
        if (parts.length === 2) {
          this.fixedWidth = parseInt(parts[0]);
          this.fixedHeight = parseInt(parts[1]);
          if (this.fixedWidthWidget) this.fixedWidthWidget.value = this.fixedWidth;
          if (this.fixedHeightWidget) this.fixedHeightWidget.value = this.fixedHeight;
          this.setWidgetValue("fixed_width", this.fixedWidth);
          this.setWidgetValue("fixed_height", this.fixedHeight);
        }
      }
    };

    nodeType.prototype.applyFixedSizeToCurrentCrop = function () {
      if (!this.fixedSizeEnabled) return;

      // Don't apply if no image loaded or invalid dimensions
      if (!this.actualImageWidth || !this.actualImageHeight ||
          this.actualImageWidth <= 0 || this.actualImageHeight <= 0) {
        return;
      }

      const preview = this.getPreviewArea();
      if (!preview.width || !preview.height) return;

      // Get the current crop center point, or use image center if no crop exists
      let centerX, centerY;
      if (this.dragStart && this.dragEnd) {
        centerX = (this.dragStart[0] + this.dragEnd[0]) / 2;
        centerY = (this.dragStart[1] + this.dragEnd[1]) / 2;
      } else {
        centerX = preview.width / 2;
        centerY = preview.height / 2;
      }

      // Calculate the preview dimensions for the fixed size
      const scaleX = this.actualImageWidth / preview.width;
      const scaleY = this.actualImageHeight / preview.height;
      const previewFixedWidth = this.fixedWidth / scaleX;
      const previewFixedHeight = this.fixedHeight / scaleY;

      // Calculate new crop rectangle, centered on the current center (or image center)
      let newLeft = centerX - previewFixedWidth / 2;
      let newTop = centerY - previewFixedHeight / 2;
      let newRight = newLeft + previewFixedWidth;
      let newBottom = newTop + previewFixedHeight;

      // Constrain to image boundaries
      if (newLeft < 0) {
        newRight -= newLeft;
        newLeft = 0;
      }
      if (newTop < 0) {
        newBottom -= newTop;
        newTop = 0;
      }
      if (newRight > preview.width) {
        newLeft -= (newRight - preview.width);
        newRight = preview.width;
      }
      if (newBottom > preview.height) {
        newTop -= (newBottom - preview.height);
        newBottom = preview.height;
      }

      // Final bounds check - ensure we don't go negative
      newLeft = Math.max(0, newLeft);
      newTop = Math.max(0, newTop);
      newRight = Math.min(preview.width, newLeft + previewFixedWidth);
      newBottom = Math.min(preview.height, newTop + previewFixedHeight);

      // Set the new crop rectangle
      this.dragStart = [newLeft, newTop];
      this.dragEnd = [newRight, newBottom];

      // Update crop values and redraw
      this.updateCropValuesFromBox();
      this.setDirtyCanvas(true);
    };

    nodeType.prototype.createFixedSizeCropAtPosition = function (clickPos, preview) {
      if (!this.fixedSizeEnabled) return;

      const scaleX = this.actualImageWidth / preview.width;
      const scaleY = this.actualImageHeight / preview.height;
      const previewFixedWidth = this.fixedWidth / scaleX;
      const previewFixedHeight = this.fixedHeight / scaleY;

      // Center the crop on the click position
      let newLeft = clickPos.x - previewFixedWidth / 2;
      let newTop = clickPos.y - previewFixedHeight / 2;
      let newRight = newLeft + previewFixedWidth;
      let newBottom = newTop + previewFixedHeight;

      // Constrain to image boundaries
      if (newLeft < 0) {
        newRight -= newLeft;
        newLeft = 0;
      }
      if (newTop < 0) {
        newBottom -= newTop;
        newTop = 0;
      }
      if (newRight > preview.width) {
        newLeft -= (newRight - preview.width);
        newRight = preview.width;
      }
      if (newBottom > preview.height) {
        newTop -= (newBottom - preview.height);
        newBottom = preview.height;
      }

      // Final bounds check - ensure we don't go negative
      newLeft = Math.max(0, newLeft);
      newTop = Math.max(0, newTop);
      newRight = Math.min(preview.width, newLeft + previewFixedWidth);
      newBottom = Math.min(preview.height, newTop + previewFixedHeight);

      // Set the new crop rectangle
      this.dragStart = [newLeft, newTop];
      this.dragEnd = [newRight, newBottom];

      // Update crop values and redraw
      this.updateCropValuesFromBox();
      this.commitState();
      this.setDirtyCanvas(true);
    };

    nodeType.prototype.forceUpdate = function () {
      const drawing_version_widget = this.getWidget("drawing_version");
      if (drawing_version_widget) {
        drawing_version_widget.value = Date.now();
      }
    };

    nodeType.prototype.setCropAndUpdate = function (changedSide) {
      this.clampCropValues(changedSide);
      this.normalizeCropBox();
      this.syncCropWidgetsFromProperties();
      this.updateBoxFromCropValues();
      this.setDirtyCanvas(true);
    };

    nodeType.prototype.syncCropWidgetsFromProperties = function () {
      if (!this.widgets) return;
      const cropMap = {
        crop_left: this.cropData_left,
        crop_right: this.cropData_right,
        crop_top: this.cropData_top,
        crop_bottom: this.cropData_bottom,
        crop_width: this.cropData_width,
        crop_height: this.cropData_height,
      };
      this.widgets.forEach((w) => {
        if (cropMap.hasOwnProperty(w.name)) {
          w.value = cropMap[w.name];
        }
      });
    };

    nodeType.prototype.onConfigure = function (o) {
      this.actualImageWidth = this.properties.actualImageWidth ?? DEFAULT_SIZE;
      this.actualImageHeight =
        this.properties.actualImageHeight ?? DEFAULT_SIZE;

      this.dragStart = this.properties.dragStart ?? [0, 0];
      this.dragEnd = this.properties.dragEnd ?? [0, 0];

      this.cropData_left = this.properties.crop_left ?? 0;
      this.cropData_right = this.properties.crop_right ?? 0;
      this.cropData_top = this.properties.crop_top ?? 0;
      this.cropData_bottom = this.properties.crop_bottom ?? 0;
      this.cropData_width = this.properties.crop_width ?? DEFAULT_SIZE;
      this.cropData_height = this.properties.crop_height ?? DEFAULT_SIZE;

      this.snapValue = this.properties.snapValue ?? DEFAULT_SNAP_VALUE;

      this.aspectRatioString =
        this.properties.aspectRatioString ?? ASPECT_STRING_MESSAGE;
      this.aspectLockEnabled = this.properties.aspectLockEnabled ?? false;

      this.infoDisplayEnabled = this.properties.infoDisplayEnabled ?? true;

      this.fixedSizeEnabled = this.properties.fixedSizeEnabled ?? false;
      this.fixedSizePreset = this.properties.fixedSizePreset || "Custom";
      // Ensure it's never None
      if (this.fixedSizePreset === "None" || this.fixedSizePreset === null || this.fixedSizePreset === undefined) {
        this.fixedSizePreset = "Custom";
      }
      this.fixedWidth = this.properties.fixedWidth ?? DEFAULT_SIZE;
      this.fixedHeight = this.properties.fixedHeight ?? DEFAULT_SIZE;
      
      // Also update the widget directly
      const presetWidget = this.getWidget("fixed_size_preset");
      if (presetWidget) {
        presetWidget.value = this.fixedSizePreset;
      }

      this.box_color = this.properties.box_color;

      this.forceUpdate();

      this.syncCropWidgetsFromProperties();
      this.updateInfoToggleLabel();
      this.updateFixedSizeWidgets();

      // Apply fixed size if enabled when loading from configuration
      if (this.fixedSizeEnabled) {
        this.applyFixedSizeToCurrentCrop();
      }

      this.commitState();

      // Check for connected LoadImage node after configuration
      setTimeout(() => {
        this.tryLoadImageFromConnectedNode();
      }, 100);
    };

    nodeType.prototype.onAdded = function () {
      const node = this;

      // Check if there's already a connected LoadImage node
      setTimeout(() => {
        this.tryLoadImageFromConnectedNode();
      }, 100);

      const originalOnMouseDown = node.onMouseDown;
      const originalOnMouseMove = node.onMouseMove;
      const originalOnMouseUp = node.onMouseUp;
      const originalOnMouseLeave = node.onMouseLeave;

      node.onMouseDown = function (e, pos, canvas) {
        const wasHandled = originalOnMouseDown?.call(this, e, pos, canvas);
        if (wasHandled) return true;
        return this.handleOnMouseDown?.(e, pos, canvas);
      };

      node.onMouseMove = function (e, pos, canvas) {
        const wasHandled = originalOnMouseMove?.call(this, e, pos, canvas);
        if (wasHandled) return true;
        return this.handleOnMouseMove?.(e, pos, canvas);
      };

      node.onMouseUp = function (e, pos, canvas) {
        const wasHandled = originalOnMouseUp?.call(this, e, pos, canvas);
        if (wasHandled) return true;
        return this.handleOnMouseUp?.(e, pos, canvas);
      };

      node.onMouseLeave = function (e, pos, canvas) {
        const wasHandled = originalOnMouseLeave?.call(this, e, pos, canvas);
        if (wasHandled) return true;
        return this.handleOnMouseLeave?.(e, pos, canvas);
      };
    };

    nodeType.prototype.commitState = function () {
      function safeAssign(target, key, value) {
        if (value !== null && value !== undefined) {
          target[key] = value;
        }
      }

      safeAssign(this.properties, "actualImageWidth", this.actualImageWidth);
      safeAssign(this.properties, "actualImageHeight", this.actualImageHeight);
      safeAssign(this.properties, "dragStart", this.dragStart);
      safeAssign(this.properties, "dragEnd", this.dragEnd);
      safeAssign(this.properties, "aspectRatioString", this.aspectRatioString);
      safeAssign(this.properties, "aspectLockEnabled", this.aspectLockEnabled);
      safeAssign(
        this.properties,
        "infoDisplayEnabled",
        this.infoDisplayEnabled
      );
      safeAssign(this.properties, "box_color", this.box_color);
      safeAssign(this.properties, "crop_left", this.cropData_left);
      safeAssign(this.properties, "crop_right", this.cropData_right);
      safeAssign(this.properties, "crop_top", this.cropData_top);
      safeAssign(this.properties, "crop_bottom", this.cropData_bottom);
      safeAssign(this.properties, "crop_width", this.cropData_width);
      safeAssign(this.properties, "crop_height", this.cropData_height);
      safeAssign(this.properties, "snapValue", this.snapValue);
      safeAssign(this.properties, "fixedSizeEnabled", this.fixedSizeEnabled);
      safeAssign(this.properties, "fixedSizePreset", this.fixedSizePreset);
      safeAssign(this.properties, "fixedWidth", this.fixedWidth);
      safeAssign(this.properties, "fixedHeight", this.fixedHeight);

      this.setWidgetValue("crop_left", this.cropData_left);
      this.setWidgetValue("crop_right", this.cropData_right);
      this.setWidgetValue("crop_top", this.cropData_top);
      this.setWidgetValue("crop_bottom", this.cropData_bottom);
      this.setWidgetValue("crop_width", this.cropData_width);
      this.setWidgetValue("crop_height", this.cropData_height);
      this.setWidgetValue("fixed_size_enabled", this.fixedSizeEnabled);
      this.setWidgetValue("fixed_size_preset", this.fixedSizePreset);
      this.setWidgetValue("fixed_width", this.fixedWidth);
      this.setWidgetValue("fixed_height", this.fixedHeight);
    };

    // Ensure widget values are valid before execution
    nodeType.prototype.onExecute = function () {
      // Make sure fixed_size_preset has a valid value
      const presetWidget = this.getWidget("fixed_size_preset");
      if (presetWidget) {
        if (!presetWidget.value || presetWidget.value === "None" || presetWidget.value === "null" || presetWidget.value === null) {
          presetWidget.value = "Custom";
        }
      }
    };
    
    nodeType.prototype.onExecuted = function (message) {
      const backendCropData = message?.crop_info?.[0] || null;
      const backendShouldResetCrop = backendCropData?.reset_crop_ui || false;

      const imageInfo = message?.images_custom?.[0];
      if (!imageInfo) {
        this.image.src = "";
        this.actualImageWidth = 0;
        this.actualImageHeight = 0;
        this.setDirtyCanvas(true);
        return;
      }

      const imageUrl = app.api.apiURL(
        `/view?filename=${imageInfo.filename}&type=${
          imageInfo.type
        }&subfolder=${imageInfo.subfolder}&rand=${Date.now()}`
      );

      this.image.onload = () => {
        this.imageLoaded = true;
        const newWidth = this.image.naturalWidth;
        const newHeight = this.image.naturalHeight;
        const resolutionId = `${newWidth}x${newHeight}`;
        const lastResolution = this.properties.lastResolution || null;
        const resolutionSame = lastResolution === resolutionId;

        const last_width_widget = this.getWidget("last_width");
        if (last_width_widget) last_width_widget.value = newWidth;

        const last_height_widget = this.getWidget("last_height");
        if (last_height_widget) last_height_widget.value = newHeight;

        if (backendShouldResetCrop || !resolutionSame) {
          this.actualImageWidth = newWidth;
          this.actualImageHeight = newHeight;
          this.properties.lastResolution = resolutionId;

          this.resetCrop(newWidth, newHeight);
          this.size = this.computeSize();

          this.updateBoxFromCropValues();
        } else {
          if (backendCropData) {
            this.cropData_left = backendCropData.left;
            this.cropData_right = backendCropData.right;
            this.cropData_top = backendCropData.top;
            this.cropData_bottom = backendCropData.bottom;

            // Update fixed size info from backend if available
            if (backendCropData.fixed_size_enabled !== undefined) {
              this.fixedSizeEnabled = backendCropData.fixed_size_enabled;
              this.setWidgetValue("fixed_size_enabled", this.fixedSizeEnabled);
              if (this.fixedSizeToggleWidget) {
                this.fixedSizeToggleWidget.value = this.fixedSizeEnabled;
              }
            }

            if (backendCropData.fixed_size_preset !== undefined) {
              this.fixedSizePreset = backendCropData.fixed_size_preset;
              this.setWidgetValue("fixed_size_preset", this.fixedSizePreset);
              if (this.fixedSizePresetWidget) {
                this.fixedSizePresetWidget.value = this.fixedSizePreset;
              }
            }

            if (backendCropData.fixed_width !== undefined) {
              this.fixedWidth = backendCropData.fixed_width;
              this.setWidgetValue("fixed_width", this.fixedWidth);
              if (this.fixedWidthWidget) {
                this.fixedWidthWidget.value = this.fixedWidth;
              }
            }

            if (backendCropData.fixed_height !== undefined) {
              this.fixedHeight = backendCropData.fixed_height;
              this.setWidgetValue("fixed_height", this.fixedHeight);
              if (this.fixedHeightWidget) {
                this.fixedHeightWidget.value = this.fixedHeight;
              }
            }

            this.syncCropWidgetsFromProperties();
            this.updateFixedSizeWidgets();
            // Apply fixed size if enabled
            if (this.fixedSizeEnabled) {
              this.applyFixedSizeToCurrentCrop();
            }
          }
          this.actualImageWidth = newWidth;
          this.actualImageHeight = newHeight;
        }

        if (this.snapValue !== null && this.snapValue !== "none") {
          this._applySnapToDragBox(parseInt(this.snapValue));
        }
        this.updateCropValuesFromBox();
        this.commitState();
        this.setDirtyCanvas(true);
      };

      this.image.onerror = () => {
        this.imageLoaded = false;
        console.warn("[DragCrop] Image failed to load");
      };

      this.image.src = imageUrl;
      this.setDirtyCanvas(true);
    };

    nodeType.prototype.onConnectionsChange = function (
      type,
      index,
      connected,
      link_info
    ) {
      if (type === LiteGraph.INPUT && link_info?.type === "IMAGE") {
        this.setDirtyCanvas(true);

        // Try to get image from connected LoadImage node
        if (connected) {
          // Reset callback setup tracker when connection changes
          this._loadImageCallbackSetup = null;
          this.tryLoadImageFromConnectedNode();
        } else {
          // Clear the callback setup when disconnected
          this._loadImageCallbackSetup = null;
          this.lastLoadedImageSource = null;
        }
      }
    };

    nodeType.prototype.tryLoadImageFromConnectedNode = function() {
      // Get the connected node
      if (!this.inputs || !this.inputs[0] || !this.graph) return;

      const link = this.graph.links[this.inputs[0].link];
      if (!link) return;

      const sourceNode = this.graph.getNodeById(link.origin_id);
      if (!sourceNode) return;

      // Check if it's a LoadImage node
      if (sourceNode.type === "LoadImage" || sourceNode.type === "LoadImageOutput") {
        // Get the image filename from the node's widgets
        const imageWidget = sourceNode.widgets?.find(w => w.name === "image");
        if (!imageWidget || !imageWidget.value) return;

        // Load the image directly without executing the graph
        const imagePath = imageWidget.value;

        // Determine the folder based on node type
        const folder = sourceNode.type === "LoadImageOutput" ? "output" : "input";

        // Create the image URL
        const imageUrl = app.api.apiURL(
          `/view?filename=${encodeURIComponent(imagePath)}&type=${folder}&subfolder=&rand=${Date.now()}`
        );

        // Track the source to avoid reloading same image
        const imageSource = `${folder}/${imagePath}`;
        if (this.lastLoadedImageSource === imageSource && this.imageLoaded) {
          return; // Skip if already loaded this image
        }
        this.lastLoadedImageSource = imageSource;

        // Load the image
        this.image.onload = () => {
          this.imageLoaded = true;
          const newWidth = this.image.naturalWidth;
          const newHeight = this.image.naturalHeight;

          this.actualImageWidth = newWidth;
          this.actualImageHeight = newHeight;

          // Reset crop to full image
          this.resetCrop(newWidth, newHeight);

          // Compute and apply new size
          const newSize = this.computeSize();
          this.size = newSize;

          // Force the node to resize itself
          if (this.graph) {
            this.graph.setDirtyCanvas(true, false);
          }

          // Invalidate preview area cache to force recalculation
          this._previewAreaCache = null;

          this.updateBoxFromCropValues();

          // Apply fixed size if enabled
          if (this.fixedSizeEnabled) {
            this.applyFixedSizeToCurrentCrop();
          }

          this.commitState();
          this.setDirtyCanvas(true);
        };

        this.image.onerror = () => {
          this.imageLoaded = false;
          console.warn("[DragCrop] Failed to load image from connected node");
        };

        this.image.src = imageUrl;

        // Set up a watcher for changes to the LoadImage widget
        // Store the callback reference on this node, not the LoadImage widget
        if (!this._loadImageCallbackSetup || this._loadImageCallbackSetup !== sourceNode.id) {
          const originalCallback = imageWidget.callback;
          const dragCropNode = this; // Capture reference to the dragcrop node

          // Wrap the original callback
          imageWidget.callback = function(value) {
            // Call original callback if it exists
            if (originalCallback && typeof originalCallback === 'function') {
              originalCallback.call(this, value);
            }
            // Reload image when LoadImage selection changes
            if (dragCropNode && dragCropNode.graph) {
              setTimeout(() => dragCropNode.tryLoadImageFromConnectedNode(), 100);
            }
          };

          // Mark that we've set up the callback for this specific source node
          this._loadImageCallbackSetup = sourceNode.id;
        }
      }
    };

    nodeType.prototype.computeSize = function () {
      if (!this.actualImageWidth || !this.actualImageHeight) {
        return [330, 330];
      }

      const minPreviewWidth = 400;
      const minPreviewHeight = 400;
      const maxPreviewWidth = 1024;
      const maxPreviewHeight = 800;

      const aspectRatio = this.actualImageWidth / this.actualImageHeight;
      let previewWidth, previewHeight;

      // Calculate preview size maintaining aspect ratio
      if (aspectRatio > 1) {
        // Landscape image
        previewWidth = minPreviewWidth;
        previewHeight = previewWidth / aspectRatio;

        // Check if height exceeds max
        if (previewHeight > maxPreviewHeight) {
          previewHeight = maxPreviewHeight;
          previewWidth = previewHeight * aspectRatio;
        }
      } else {
        // Portrait or square image - start with width and calculate height
        previewWidth = minPreviewWidth;
        previewHeight = previewWidth / aspectRatio;

        // Check if height exceeds max
        if (previewHeight > maxPreviewHeight) {
          previewHeight = maxPreviewHeight;
          previewWidth = previewHeight * aspectRatio;
        }
      }

      previewWidth = Math.max(200, previewWidth);
      previewHeight = Math.max(200, previewHeight);

      // Use same padding values as getPreviewArea()
      const padding = 20;
      const baseWidth = Math.min(previewWidth + (padding * 2), maxPreviewWidth + 40);
      const headerHeight = 30; // Standard node header height
      const widgetHeight = this.getWidgetsHeight();
      
      // Match the offsets used in getPreviewArea()
      const topOffset = headerHeight + widgetHeight + 25; // 25px padding after widgets
      const bottomOffset = 50 + 30 + 10; // infoTextHeight(50) + instructionHeight(30) + padding(10)

      let totalHeight = topOffset + previewHeight + bottomOffset;

      this._computedAspectRatio = baseWidth / totalHeight;
      this._computedWidth = baseWidth;
      this._computedHeight = totalHeight;

      return [baseWidth, totalHeight];
    };

    nodeType.prototype.onResize = function (size) {
      if (!this.actualImageWidth || !this.actualImageHeight || !size) {
        return;
      }

      const [newWidth, newHeight] = size;

      const padding = 20;
      const paddingX = padding * 2; // 20px on each side
      const previewWidth = newWidth - paddingX;

      const minPreviewWidth = 200;
      const maxPreviewWidth = 1200;

      const clampedPreviewWidth = Math.max(
        minPreviewWidth,
        Math.min(previewWidth, maxPreviewWidth)
      );

      this.userPreferredWidth = clampedPreviewWidth;

      const aspectRatio = this.actualImageWidth / this.actualImageHeight;
      const newPreviewHeight = clampedPreviewWidth / aspectRatio;

      const headerHeight = 30;
      const widgetHeight = this.getWidgetsHeight();
      
      // Use same offsets as computeSize() and getPreviewArea()
      const topOffset = headerHeight + widgetHeight + 25; // 25px padding after widgets
      const bottomOffset = 50 + 30 + 10; // infoTextHeight(50) + instructionHeight(30) + padding(10)

      const totalHeight = topOffset + newPreviewHeight + bottomOffset;

      this.size = [clampedPreviewWidth + paddingX, totalHeight];

      this.updateBoxFromCropValues();
      this.setDirtyCanvas(true);
    };

    nodeType.prototype.handleOnMouseDown = function (e, pos, graphCanvas) {
      const mousePos = [e.canvasX, e.canvasY];
      let local = this.getPreviewLocalPos(mousePos);

      if (this.dragStart && this.dragEnd) {
        this.normalizeCropBox();
      }

      const hit = this.getCropBoxHitArea(local);
      if (hit) {
        // In fixed size mode, only allow moving
        if (this.fixedSizeEnabled && hit !== "move") {
          return false; // Don't allow resizing operations
        }

        this.dragging = true;
        this.dragMode = hit;
        this.dragStartPos = mousePos;
        this.originalDragStart = clonePoint(this.dragStart);
        this.originalDragEnd = clonePoint(this.dragEnd);

        this.cachedWidth = Math.abs(this.dragEnd[0] - this.dragStart[0]);
        this.cachedHeight = Math.abs(this.dragEnd[1] - this.dragStart[1]);

        [this.cachedWidth, this.cachedHeight] = getBoxSize(
          this.dragStart,
          this.dragEnd
        );

        this.updateCropValuesFromBox();
        this.setDirtyCanvas(true);
        return true;
      }

      const preview = this.getPreviewArea();
      if (
        local.x > 0 &&
        local.y > 0 &&
        local.x < preview.width &&
        local.y < preview.height
      ) {
        // In fixed size mode, create a new crop with fixed dimensions at the click position
        if (this.fixedSizeEnabled) {
          this.createFixedSizeCropAtPosition(local, preview);
          return true;
        }

        this.dragging = true;
        this.dragMode = "new";
        this.newCropStart = [local.x, local.y];
        this.newCropInitialized = false;
        this.dragStartPos = mousePos;
        this.cachedWidth = null;
        this.cachedHeight = null;
        return true;
      }

      return false;
    };

    function clamp(val, min, max) {
      return Math.max(min, Math.min(val, max));
    }

    function clampPointToRect(pos, width, height) {
      return [clamp(pos[0], 0, width), clamp(pos[1], 0, height)];
    }

    function isWithinBounds(start, end, width, height) {
      const [minX, minY] = [
        Math.min(start[0], end[0]),
        Math.min(start[1], end[1]),
      ];
      const [maxX, maxY] = [
        Math.max(start[0], end[0]),
        Math.max(start[1], end[1]),
      ];
      return minX >= 0 && minY >= 0 && maxX <= width && maxY <= height;
    }

    function getBoxSize(start, end) {
      return [Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1])];
    }

    function clonePoint(point) {
      return point.slice();
    }

    nodeType.prototype.handleNewDrag = function (
      mousePosLocal,
      preview,
      MIN_WIDTH,
      MIN_HEIGHT,
      lockedAspectRatio
    ) {
      if (!this.newCropInitialized) {
        this.dragStart = [mousePosLocal.x, mousePosLocal.y];
        this.dragEnd = [mousePosLocal.x, mousePosLocal.y];
        this.initialDragDir = [0, 0];
        this.newCropInitialized = true;
        return true;
      }

      const [startX, startY] = this.dragStart;
      const dx = mousePosLocal.x - startX;
      const dy = mousePosLocal.y - startY;

      if (this.initialDragDir[0] === 0 && this.initialDragDir[1] === 0) {
        this.initialDragDir = [Math.sign(dx) || 1, Math.sign(dy) || 1];
      }

      const [dirX0, dirY0] = this.initialDragDir;
      let dirX = Math.sign(dx) || 1;
      let dirY = Math.sign(dy) || 1;

      let width = Math.abs(dx);
      let height = Math.abs(dy);

      if (lockedAspectRatio) {
        if (width / height > lockedAspectRatio) {
          width = height * lockedAspectRatio;
        } else {
          height = width / lockedAspectRatio;
        }

        const maxW = dirX0 > 0 ? preview.width - startX : startX;
        const maxH = dirY0 > 0 ? preview.height - startY : startY;

        width = Math.min(width, maxW);
        height = Math.min(height, maxH);

        width = Math.max(width, MIN_WIDTH);
        height = Math.max(height, MIN_HEIGHT);
      } else {
        if (width < MIN_WIDTH || dirX !== dirX0) {
          width = MIN_WIDTH;
          dirX = dirX0;
        }
        if (height < MIN_HEIGHT || dirY !== dirY0) {
          height = MIN_HEIGHT;
          dirY = dirY0;
        }
      }

      this.dragEnd = [startX + dirX * width, startY + dirY * height];
      return true;
    };

    nodeType.prototype.handleAspectRatioMove = function (
      mousePosLocal,
      preview
    ) {
      const width = this.dragEnd[0] - this.dragStart[0];
      const height = this.dragEnd[1] - this.dragStart[1];

      const centerOffset = [width / 2, height / 2];

      const proposedStart = [
        mousePosLocal.x - centerOffset[0],
        mousePosLocal.y - centerOffset[1],
      ];

      const clampedStartX = clamp(proposedStart[0], 0, preview.width - width);
      const clampedStartY = clamp(proposedStart[1], 0, preview.height - height);
      const clampedEndX = clampedStartX + width;
      const clampedEndY = clampedStartY + height;

      this.dragStart = [clampedStartX, clampedStartY];
      this.dragEnd = [clampedEndX, clampedEndY];
    };

    function handleAspectRatioCornerDrag(
      mode,
      mousePosLocal,
      preview,
      originalDragStart,
      originalDragEnd,
      aspectRatio,
      MIN_WIDTH,
      MIN_HEIGHT,
      node
    ) {
      const anchorMap = {
        "bottom-right": clonePoint(originalDragStart),
        "top-left": clonePoint(originalDragEnd),
        "top-right": [originalDragStart[0], originalDragEnd[1]],
        "bottom-left": [originalDragEnd[0], originalDragStart[1]],
      };

      const anchor = anchorMap[mode];
      const isRight = mode.includes("right");
      const isBottom = mode.includes("bottom");

      const maxW = isRight ? preview.width - anchor[0] : anchor[0];
      const maxH = isBottom ? preview.height - anchor[1] : anchor[1];

      let newWidth = Math.abs(mousePosLocal.x - anchor[0]);
      let newHeight = Math.abs(mousePosLocal.y - anchor[1]);

      if (newWidth / aspectRatio > newHeight) {
        newHeight = newWidth / aspectRatio;
      } else {
        newWidth = newHeight * aspectRatio;
      }

      newWidth = Math.min(newWidth, maxW);
      newHeight = Math.min(newHeight, maxH);

      if (newWidth === maxW) newHeight = newWidth / aspectRatio;
      if (newHeight === maxH) newWidth = newHeight * aspectRatio;

      newWidth = Math.max(newWidth, MIN_WIDTH);
      newHeight = Math.max(newHeight, MIN_HEIGHT);

      if (isRight) node.dragEnd[0] = anchor[0] + newWidth;
      else node.dragStart[0] = anchor[0] - newWidth;

      if (isBottom) node.dragEnd[1] = anchor[1] + newHeight;
      else node.dragStart[1] = anchor[1] - newHeight;
    }

    function handleAspectRatioEdgeDrag(
      mode,
      mousePosLocal,
      preview,
      dragStart,
      dragEnd,
      aspectRatio,
      MIN_WIDTH,
      MIN_HEIGHT,
      node
    ) {
      switch (mode) {
        case "left": {
          const maxX = dragEnd[0] - MIN_WIDTH;
          const proposedX = clamp(mousePosLocal.x, 0, maxX);
          const width = dragEnd[0] - proposedX;
          let height = width / aspectRatio;

          if (dragEnd[1] - height < 0) {
            height = dragEnd[1];
          }

          const finalWidth = height * aspectRatio;
          if (finalWidth >= MIN_WIDTH && height >= MIN_HEIGHT) {
            node.dragStart = [dragEnd[0] - finalWidth, dragEnd[1] - height];
            node.dragEnd = [...dragEnd];
          }
          break;
        }

        case "right": {
          const minX = dragStart[0] + MIN_WIDTH;
          const proposedX = clamp(mousePosLocal.x, minX, preview.width);
          const width = proposedX - dragStart[0];
          let height = width / aspectRatio;

          if (dragStart[1] + height > preview.height) {
            height = preview.height - dragStart[1];
          }

          const finalWidth = height * aspectRatio;
          if (finalWidth >= MIN_WIDTH && height >= MIN_HEIGHT) {
            node.dragEnd = [dragStart[0] + finalWidth, dragStart[1] + height];
            node.dragStart = [...dragStart];
          }
          break;
        }

        case "top": {
          const maxY = dragEnd[1] - MIN_HEIGHT;
          const proposedY = clamp(mousePosLocal.y, 0, maxY);
          const height = dragEnd[1] - proposedY;
          let width = height * aspectRatio;

          if (dragEnd[0] - width < 0) {
            width = dragEnd[0];
          }

          const finalHeight = width / aspectRatio;
          if (width >= MIN_WIDTH && finalHeight >= MIN_HEIGHT) {
            node.dragStart = [dragEnd[0] - width, dragEnd[1] - finalHeight];
            node.dragEnd = [...dragEnd];
          }
          break;
        }

        case "bottom": {
          const minY = dragStart[1] + MIN_HEIGHT;
          const proposedY = clamp(mousePosLocal.y, minY, preview.height);
          const height = proposedY - dragStart[1];
          let width = height * aspectRatio;

          if (dragStart[0] + width > preview.width) {
            width = preview.width - dragStart[0];
          }

          const finalHeight = width / aspectRatio;
          if (width >= MIN_WIDTH && finalHeight >= MIN_HEIGHT) {
            node.dragEnd = [dragStart[0] + width, dragStart[1] + finalHeight];
            node.dragStart = [...dragStart];
          }
          break;
        }
      }
    }

    nodeType.prototype.handleAspectRatioDrag = function (
      mousePosLocal,
      preview,
      MIN_WIDTH,
      MIN_HEIGHT,
      lockedAspectRatio
    ) {
      const dragMode = this.dragMode;

      switch (dragMode) {
        case "top-left":
        case "top-right":
        case "bottom-left":
        case "bottom-right":
          return handleAspectRatioCornerDrag(
            dragMode,
            mousePosLocal,
            preview,
            this.originalDragStart,
            this.originalDragEnd,
            lockedAspectRatio,
            MIN_WIDTH,
            MIN_HEIGHT,
            this
          );

        case "left":
        case "right":
        case "top":
        case "bottom":
          return handleAspectRatioEdgeDrag(
            dragMode,
            mousePosLocal,
            preview,
            this.dragStart,
            this.dragEnd,
            lockedAspectRatio,
            MIN_WIDTH,
            MIN_HEIGHT,
            this
          );
      }
    };

    function handleMoveDrag(node, mousePosLocal, preview) {
      const startLocal = node.getPreviewLocalPos(node.dragStartPos);
      const [dx, dy] = [
        mousePosLocal.x - startLocal.x,
        mousePosLocal.y - startLocal.y,
      ];

      const origMinX = Math.min(
        node.originalDragStart[0],
        node.originalDragEnd[0]
      );
      const origMinY = Math.min(
        node.originalDragStart[1],
        node.originalDragEnd[1]
      );

      const constrainedMinX = clamp(
        origMinX + dx,
        0,
        preview.width - node.cachedWidth
      );
      const constrainedMinY = clamp(
        origMinY + dy,
        0,
        preview.height - node.cachedHeight
      );

      const newStart = [constrainedMinX, constrainedMinY];
      const newEnd = [
        constrainedMinX + node.cachedWidth,
        constrainedMinY + node.cachedHeight,
      ];

      return [newStart, newEnd];
    }

    function handleEdgeDragBox(
      mode,
      mousePosLocal,
      dragStart,
      dragEnd,
      MIN_WIDTH,
      MIN_HEIGHT,
      preview
    ) {
      let newStart = clonePoint(dragStart);
      let newEnd = clonePoint(dragEnd);

      switch (mode) {
        case "left":
          newStart[0] = clamp(mousePosLocal.x, 0, dragEnd[0] - MIN_WIDTH);
          break;
        case "right":
          newEnd[0] = clamp(
            mousePosLocal.x,
            dragStart[0] + MIN_WIDTH,
            preview.width
          );
          break;
        case "top":
          newStart[1] = clamp(mousePosLocal.y, 0, dragEnd[1] - MIN_HEIGHT);
          break;
        case "bottom":
          newEnd[1] = clamp(
            mousePosLocal.y,
            dragStart[1] + MIN_HEIGHT,
            preview.height
          );
          break;
      }

      return [newStart, newEnd];
    }

    function handleCornerDragBox(
      mode,
      mousePosLocal,
      dragStart,
      dragEnd,
      MIN_WIDTH,
      MIN_HEIGHT,
      preview
    ) {
      let newStart = clonePoint(dragStart);
      let newEnd = clonePoint(dragEnd);

      switch (mode) {
        case "top-left":
          newStart[0] = clamp(mousePosLocal.x, 0, dragEnd[0] - MIN_WIDTH);
          newStart[1] = clamp(mousePosLocal.y, 0, dragEnd[1] - MIN_HEIGHT);
          break;
        case "top-right":
          newEnd[0] = clamp(
            mousePosLocal.x,
            dragStart[0] + MIN_WIDTH,
            preview.width
          );
          newStart[1] = clamp(mousePosLocal.y, 0, dragEnd[1] - MIN_HEIGHT);
          break;
        case "bottom-left":
          newStart[0] = clamp(mousePosLocal.x, 0, dragEnd[0] - MIN_WIDTH);
          newEnd[1] = clamp(
            mousePosLocal.y,
            dragStart[1] + MIN_HEIGHT,
            preview.height
          );
          break;
        case "bottom-right":
          newEnd[0] = clamp(
            mousePosLocal.x,
            dragStart[0] + MIN_WIDTH,
            preview.width
          );
          newEnd[1] = clamp(
            mousePosLocal.y,
            dragStart[1] + MIN_HEIGHT,
            preview.height
          );
          break;
      }

      return [newStart, newEnd];
    }

    nodeType.prototype.handleEdgeOrMoveDrag = function (
      mousePosLocal,
      preview,
      MIN_WIDTH,
      MIN_HEIGHT
    ) {
      const dragMode = this.dragMode;

      let newStart = clonePoint(this.dragStart);
      let newEnd = clonePoint(this.dragEnd);

      if (dragMode === "move") {
        [newStart, newEnd] = handleMoveDrag(this, mousePosLocal, preview);
      } else if (["left", "right", "top", "bottom"].includes(dragMode)) {
        [newStart, newEnd] = handleEdgeDragBox(
          dragMode,
          mousePosLocal,
          this.dragStart,
          this.dragEnd,
          MIN_WIDTH,
          MIN_HEIGHT,
          preview
        );
      } else {
        [newStart, newEnd] = handleCornerDragBox(
          dragMode,
          mousePosLocal,
          this.dragStart,
          this.dragEnd,
          MIN_WIDTH,
          MIN_HEIGHT,
          preview
        );
      }

      if (isWithinBounds(newStart, newEnd, preview.width, preview.height)) {
        this.dragStart = newStart;
        this.dragEnd = newEnd;

        if (dragMode === "move" && this.cachedWidth && this.cachedHeight) {
          const [w, h] = getBoxSize(newStart, newEnd);
          if (
            Math.abs(w - this.cachedWidth) > 0.001 ||
            Math.abs(h - this.cachedHeight) > 0.001
          ) {
            console.warn(
              `Move dimension drift! Expected ${this.cachedWidth}x${this.cachedHeight}, Got ${w}x${h}`
            );
          }
        }
      }
    };

    nodeType.prototype.handleOnMouseMove = function (e, pos, graphCanvas) {
      if (!this.dragging || !this.dragStart || !this.dragEnd) return false;

      if (e.buttons !== 1) {
        this.handleOnMouseUp(e, pos);
        return false;
      }

      const mousePos = [e.canvasX, e.canvasY];
      const mousePosLocal = this.getPreviewLocalPos(mousePos);
      const preview = this.getPreviewArea();
      const lockedAspectRatio = this.getLockedAspectRatio();

      MIN_CROP_DIMENSION;
      const scaleX = this.actualImageWidth / preview.width;
      const scaleY = this.actualImageHeight / preview.height;
      const MIN_WIDTH = MIN_CROP_DIMENSION / scaleX;
      const MIN_HEIGHT = MIN_CROP_DIMENSION / scaleY;

      const [clampedX, clampedY] = clampPointToRect(
        [mousePosLocal.x, mousePosLocal.y],
        preview.width,
        preview.height
      );
      mousePosLocal.x = clampedX;
      mousePosLocal.y = clampedY;

      if (this.dragMode === "new") {
        // For fixed size mode, don't allow new drags - the size is fixed
        if (this.fixedSizeEnabled) {
          return true; // Consume the event but don't change anything
        }
        this.handleNewDrag(
          mousePosLocal,
          preview,
          MIN_WIDTH,
          MIN_HEIGHT,
          lockedAspectRatio
        );
      } else if (this.dragMode === "move") {
        if (lockedAspectRatio) {
          this.handleAspectRatioMove(mousePosLocal, preview);
        } else {
          this.handleEdgeOrMoveDrag(
            mousePosLocal,
            preview,
            MIN_WIDTH,
            MIN_HEIGHT
          );
        }
      } else if (this.fixedSizeEnabled) {
        // In fixed size mode, only allow moving, not resizing
        if (this.dragMode === "move") {
          this.handleEdgeOrMoveDrag(
            mousePosLocal,
            preview,
            MIN_WIDTH,
            MIN_HEIGHT
          );
        }
        // Ignore resize operations in fixed size mode
        return true;
      } else if (lockedAspectRatio) {
        this.handleAspectRatioDrag(
          mousePosLocal,
          preview,
          MIN_WIDTH,
          MIN_HEIGHT,
          lockedAspectRatio
        );
      } else {
        this.handleEdgeOrMoveDrag(
          mousePosLocal,
          preview,
          MIN_WIDTH,
          MIN_HEIGHT
        );
      }

      this.updateCropValuesFromBox();
      this.setDirtyCanvas(true);
      return true;
    };

    nodeType.prototype._restoreExactBoxDimensionsIfMoved = function () {
      if (
        this.cachedWidth !== null &&
        this.cachedHeight !== null &&
        this.dragMode === "move"
      ) {
        const [currentWidth, currentHeight] = getBoxSize(
          this.dragStart,
          this.dragEnd
        );

        if (
          Math.abs(currentWidth - this.cachedWidth) > 0.001 ||
          Math.abs(currentHeight - this.cachedHeight) > 0.001
        ) {
          const minX = Math.min(this.dragStart[0], this.dragEnd[0]);
          const minY = Math.min(this.dragStart[1], this.dragEnd[1]);
          this.dragStart = [minX, minY];
          this.dragEnd = [minX + this.cachedWidth, minY + this.cachedHeight];
        }
      }
    };

    nodeType.prototype._finalizeCrop = function () {
      if (this.dragMode === "new") {
        this.normalizeCropBox();
      }

      if (this.snapValue !== null && this.snapValue !== "none") {
        this._applySnapToDragBox(parseInt(this.snapValue));
      }

      this.updateCropValuesFromBox();

      this.cachedWidth = null;
      this.cachedHeight = null;
      this.dragMode = null;
      this.dragStartPos = null;
      this.originalDragStart = null;
      this.originalDragEnd = null;

      this.commitState();
    };

    nodeType.prototype.handleOnMouseUp = function (e, pos, graphCanvas) {
      if (!this.dragging) return false;

      this.dragging = false;

      this._restoreExactBoxDimensionsIfMoved();
      this._finalizeCrop();

      return true;
    };

    nodeType.prototype.handleOnMouseLeave = function (e) {
      if (this.dragging) {
        this.dragging = false;

        this._restoreExactBoxDimensionsIfMoved();
        this._finalizeCrop();
      }
    };

    nodeType.prototype._applySnapToDragBox = function (snapValue) {
      const preview = this.getPreviewArea();
      const scaleX = this.actualImageWidth / preview.width;
      const scaleY = this.actualImageHeight / preview.height;

      let startX = Math.min(this.dragStart[0], this.dragEnd[0]) * scaleX;
      let startY = Math.min(this.dragStart[1], this.dragEnd[1]) * scaleY;
      let width = Math.abs(this.dragEnd[0] - this.dragStart[0]) * scaleX;
      let height = Math.abs(this.dragEnd[1] - this.dragStart[1]) * scaleY;

      let snappedWidth = Math.round(width / snapValue) * snapValue;
      let snappedHeight = Math.round(height / snapValue) * snapValue;

      if (startX + snappedWidth > this.actualImageWidth) {
        snappedWidth =
          Math.floor((this.actualImageWidth - startX - 1) / snapValue) *
          snapValue;
      }

      if (startY + snappedHeight > this.actualImageHeight) {
        snappedHeight =
          Math.floor((this.actualImageHeight - startY - 1) / snapValue) *
          snapValue;
      }

      snappedWidth = Math.max(snapValue, snappedWidth);
      snappedHeight = Math.max(snapValue, snappedHeight);

      let endX = startX + snappedWidth;
      let endY = startY + snappedHeight;

      this.dragStart = [startX / scaleX, startY / scaleY];
      this.dragEnd = [endX / scaleX, endY / scaleY];
    };

    nodeType.prototype.getPreviewArea = function () {
      const widgetHeight = this.getWidgetsHeight();
      const cacheKey = `${this.size?.[0]}x${this.size?.[1]}_${this.actualImageWidth}x${this.actualImageHeight}_wh${widgetHeight}`;

      if (this._previewAreaCache && this._previewAreaCache.key === cacheKey) {
        return this._previewAreaCache.value;
      }

      if (
        !this.actualImageWidth ||
        !this.actualImageHeight ||
        this.actualImageHeight <= 0
      ) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      const padding = 20;
      const headerHeight = 30; // Standard node header height
      // widgetHeight already calculated above for cache key
      const infoTextHeight = 50; // Space for the 3 lines of info text
      const instructionHeight = 30; // Space for instruction text at bottom

      // Calculate available space for preview
      const topOffset = headerHeight + widgetHeight + 25; // 25px padding after widgets
      const bottomOffset = infoTextHeight + instructionHeight + 10; // Space needed at bottom

      const maxPreviewWidth = this.size[0] - padding * 2;
      const maxPreviewHeight = this.size[1] - topOffset - bottomOffset;

      // Ensure minimum preview size
      if (maxPreviewHeight < 100) {
        // Node is too small, use minimum
        const area = {
          x: padding,
          y: topOffset,
          width: Math.max(100, maxPreviewWidth),
          height: 100,
        };
        this._previewAreaCache = { key: cacheKey, value: area };
        return area;
      }

      const aspectRatio = this.actualImageWidth / this.actualImageHeight;
      let previewWidth, previewHeight;

      if (maxPreviewWidth / maxPreviewHeight > aspectRatio) {
        previewHeight = maxPreviewHeight;
        previewWidth = previewHeight * aspectRatio;
      } else {
        previewWidth = maxPreviewWidth;
        previewHeight = previewWidth / aspectRatio;
      }

      const xOffset = (this.size[0] - previewWidth) / 2 - padding;
      const yOffset = topOffset;

      const area = {
        x: padding + xOffset,
        y: yOffset,
        width: previewWidth,
        height: previewHeight,
      };

      this._previewAreaCache = {
        key: cacheKey,
        value: area,
      };

      return area;
    };

    nodeType.prototype.getLockedAspectRatio = function () {
      if (!this.aspectLockEnabled) return null;

      const ratioStr = String(this.aspectRatioString || "").trim();
      if (!ratioStr) return null;

      if (ratioStr.includes(":")) {
        const parts = ratioStr.split(":").map(Number);
        if (
          parts.length === 2 &&
          !isNaN(parts[0]) &&
          !isNaN(parts[1]) &&
          parts[1] !== 0
        ) {
          return parts[0] / parts[1];
        }
      } else {
        const num = parseFloat(ratioStr);
        if (!isNaN(num) && num > 0) {
          return num;
        }
      }

      return null;
    };

    nodeType.prototype.setRatioFromCurrentCrop = function () {
      if (!this.dragStart || !this.dragEnd) return;

      this.normalizeCropBox();
      const [x0, y0] = this.dragStart;
      const [x1, y1] = this.dragEnd;
      const boxWidth = x1 - x0;
      const boxHeight = y1 - y0;

      if (boxWidth > 0 && boxHeight > 0) {
        const ratio = (boxWidth / boxHeight).toFixed(3);
        this.aspectRatioString = ratio;
        const ratioWidget = this.getWidget("Aspect Ratio");
        if (ratioWidget) {
          ratioWidget.value = ratio;
        }
        this.setDirtyCanvas(true);
      }
    };

    nodeType.prototype.getPreviewLocalPos = function (pos) {
      const previewArea = this.getPreviewArea();
      return {
        x: pos[0] - this.pos[0] - previewArea.x,
        y: pos[1] - this.pos[1] - previewArea.y,
      };
    };

    nodeType.prototype.resetCrop = function (
      width = DEFAULT_SIZE,
      height = DEFAULT_SIZE
    ) {
      this.cropData_left = 0;
      this.cropData_right = 0;
      this.cropData_top = 0;
      this.cropData_bottom = 0;
      this.cropData_width = width;
      this.cropData_height = height;
      this.dragStart = [0, 0];
      const previewArea = this.getPreviewArea();
      this.dragEnd = [previewArea.width, previewArea.height];

      if (this.widgets) {
        this.widgets.forEach((w) => {
          if (w.name.startsWith("crop_")) {
            w.value = 0;
          }
        });
      }

      // Apply fixed size if enabled after reset
      if (this.fixedSizeEnabled) {
        this.applyFixedSizeToCurrentCrop();
      }
    };

    nodeType.prototype.normalizeCropBox = function () {
      const [x0, y0] = this.dragStart;
      const [x1, y1] = this.dragEnd;
      const minX = Math.min(x0, x1);
      const minY = Math.min(y0, y1);
      const maxX = Math.max(x0, x1);
      const maxY = Math.max(y0, y1);

      this.dragStart = [minX, minY];
      this.dragEnd = [maxX, maxY];
    };

    nodeType.prototype.clampCropValues = function (changedSide) {
      const w = this.actualImageWidth || DEFAULT_SIZE;
      const h = this.actualImageHeight || DEFAULT_SIZE;

      let l = this.cropData_left || 0;
      let r = this.cropData_right || 0;
      let t = this.cropData_top || 0;
      let b = this.cropData_bottom || 0;

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

      this.cropData_left = l;
      this.cropData_right = r;
      this.cropData_top = t;
      this.cropData_bottom = b;
      this.cropData_width = Math.abs(w - l - r);
      this.cropData_height = Math.abs(h - t - b);
    };

    nodeType.prototype.getClippedCropBox = function () {
      const previewArea = this.getPreviewArea();

      if (
        !this.dragStart ||
        !this.dragEnd ||
        !this.actualImageWidth ||
        !this.actualImageHeight
      )
        return null;

      const cropX =
        Math.min(this.dragStart[0], this.dragEnd[0]) + previewArea.x;
      const cropY =
        Math.min(this.dragStart[1], this.dragEnd[1]) + previewArea.y;
      const cropW = Math.abs(this.dragStart[0] - this.dragEnd[0]);
      const cropH = Math.abs(this.dragStart[1] - this.dragEnd[1]);

      const minSize = 1;
      const finalCropW = Math.max(cropW, minSize);
      const finalCropH = Math.max(cropH, minSize);

      const clippedX = Math.max(cropX, previewArea.x);
      const clippedY = Math.max(cropY, previewArea.y);

      const maxW = previewArea.x + previewArea.width - clippedX;
      const maxH = previewArea.y + previewArea.height - clippedY;

      const clippedW = Math.min(finalCropW, Math.max(maxW, 0));
      const clippedH = Math.min(finalCropH, Math.max(maxH, 0));

      const pixelW = (clippedW / previewArea.width) * this.actualImageWidth;
      const pixelH = (clippedH / previewArea.height) * this.actualImageHeight;

      return {
        clippedX,
        clippedY,
        clippedW,
        clippedH,
        pixelW,
        pixelH,
      };
    };

    nodeType.prototype.updateCropValuesFromBox = function (
      updateProperties = true
    ) {
      if (!this.dragStart || !this.dragEnd) {
        console.warn(
          `[DragCrop] Node ${this.id}: Missing dragStart or dragEnd`
        );
        return;
      }

      const preview = this.getPreviewArea();
      const scaleX = this.actualImageWidth / preview.width;
      const scaleY = this.actualImageHeight / preview.height;
      const startX = Math.min(this.dragStart[0], this.dragEnd[0]);
      const startY = Math.min(this.dragStart[1], this.dragEnd[1]);
      const endX = Math.max(this.dragStart[0], this.dragEnd[0]);
      const endY = Math.max(this.dragStart[1], this.dragEnd[1]);

      const cropLeft = startX * scaleX;
      const cropRight = this.actualImageWidth - endX * scaleX;
      const cropTop = startY * scaleY;
      const cropBottom = this.actualImageHeight - endY * scaleY;
      const width = this.actualImageWidth - cropLeft - cropRight;
      const height = this.actualImageHeight - cropTop - cropBottom;

      if (updateProperties) {
        this.cropData_left = cropLeft;
        this.cropData_right = cropRight;
        this.cropData_top = cropTop;
        this.cropData_bottom = cropBottom;
        this.cropData_width = width;
        this.cropData_height = height;
      }

      this.setWidgetValue("crop_left", this.cropData_left);
      this.setWidgetValue("crop_right", this.cropData_right);
      this.setWidgetValue("crop_top", this.cropData_top);
      this.setWidgetValue("crop_bottom", this.cropData_bottom);
      this.setWidgetValue("crop_width", this.cropData_width);
      this.setWidgetValue("crop_height", this.cropData_height);

      this.setDirtyCanvas(true);
    };

    nodeType.prototype.updateBoxFromCropValues = function () {
      const w = this.actualImageWidth;
      const h = this.actualImageHeight;
      if (!w || !h || w <= 0 || h <= 0) {
        console.warn(`[DragCrop] Invalid image size.`);
        return;
      }

      const preview = this.getPreviewArea();
      if (!preview.width || !preview.height) {
        console.warn(`[DragCrop] Invalid preview area.`);
        return;
      }

      const l = this.cropData_left || 0;
      const r = this.cropData_right || 0;
      const t = this.cropData_top || 0;
      const b = this.cropData_bottom || 0;

      const cropW = w - l - r;
      const cropH = h - t - b;
      if (cropW <= 0 || cropH <= 0) {
        console.warn(`[DragCrop] Invalid crop size (${cropW}×${cropH})`);
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

      this.dragStart = [x, y];
      this.dragEnd = [x + pxW, y + pxH];
    };

    nodeType.prototype.getCropBoxHitArea = function (pos) {
      if (!this.dragStart || !this.dragEnd) {
        return null;
      }

      const localX = pos.x;
      const localY = pos.y;

      const x1 = this.dragStart[0];
      const y1 = this.dragStart[1];
      const x2 = this.dragEnd[0];
      const y2 = this.dragEnd[1];
      const cropX = Math.min(x1, x2);
      const cropY = Math.min(y1, y2);
      const cropW = Math.abs(x1 - x2);
      const cropH = Math.abs(y1 - y2);

      // In fixed size mode, only allow moving via center circle
      if (this.fixedSizeEnabled) {
        const centerX = cropX + cropW / 2;
        const centerY = cropY + cropH / 2;
        const handleRadius = Math.max(6, HANDLE_SIZE + 2) / 2;
        const distToCenter = Math.sqrt(
          Math.pow(localX - centerX, 2) + Math.pow(localY - centerY, 2)
        );

        if (distToCenter <= handleRadius) {
          return "move";
        }

        // Also allow clicking anywhere in the crop area to move in fixed size mode
        if (localX >= cropX && localX <= cropX + cropW &&
            localY >= cropY && localY <= cropY + cropH) {
          return "move";
        }

        return null;
      }

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
    };

    nodeType.prototype.updateCropDisplayValues = function ({ round = false }) {
      let left = this.cropData_left || 0;
      let right = this.cropData_right || 0;
      let top = this.cropData_top || 0;
      let bottom = this.cropData_bottom || 0;

      let width = this.cropData_width || 0;
      let height = this.cropData_height || 0;
      let percentWidth = (width / this.actualImageWidth) * 100.0;
      let percentHeight = (height / this.actualImageHeight) * 100.0;

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

      this.cropDisplayValues = {
        left,
        right,
        top,
        bottom,
        width,
        height,
        percentWidth,
        percentHeight,
      };

      return { ...this.cropDisplayValues };
    };

    nodeType.prototype.drawCropBox = function (
      ctx,
      previewArea,
      clippedX,
      clippedY,
      clippedW,
      clippedH
    ) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.beginPath();
      ctx.rect(
        previewArea.x,
        previewArea.y,
        previewArea.width,
        previewArea.height
      );
      ctx.rect(clippedX, clippedY, clippedW, clippedH);
      ctx.fill("evenodd");

      ctx.strokeStyle = this.box_color;
      ctx.lineWidth = 1;
      ctx.strokeRect(clippedX, clippedY, clippedW, clippedH);

      ctx.fillStyle = this.box_color;
      ctx.font = "12px Arial";
      ctx.textAlign = "center";

      this.updateCropDisplayValues({ round: true });
      if (this.infoDisplayEnabled && this.cropDisplayValues) {
        ctx.fillText(
          `${this.cropDisplayValues.percentWidth} × ${this.cropDisplayValues.percentHeight} %`,
          clippedX + clippedW / 2,
          clippedY + clippedH / 2 + 6
        );
        ctx.fillText(
          `${this.cropDisplayValues.width} × ${this.cropDisplayValues.height} px`,
          clippedX + clippedW / 2,
          clippedY + clippedH / 2 + 20
        );
      }

      // Only show resize handles if not in fixed size mode
      if (!this.fixedSizeEnabled) {
        const handleSize = Math.max(4, HANDLE_SIZE);
        const half = handleSize / 2;
        const handlePositions = [
          [clippedX, clippedY],
          [clippedX + clippedW, clippedY],
          [clippedX, clippedY + clippedH],
          [clippedX + clippedW, clippedY + clippedH],
        ];

        ctx.fillStyle = ColorUtils.darken(this.box_color, 80);
        ctx.strokeStyle = this.box_color;
        ctx.lineWidth = 1;

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

        ctx.fillStyle = ColorUtils.darken(this.box_color, 80);
        edgePositions.forEach(([hx, hy]) => {
          ctx.beginPath();
          ctx.rect(hx - half, hy - half, handleSize, handleSize);
          ctx.fill();
          ctx.stroke();
        });
      } else {
        // In fixed size mode, show a center handle for moving
        const handleSize = Math.max(6, HANDLE_SIZE + 2);
        const half = handleSize / 2;
        const centerX = clippedX + clippedW / 2;
        const centerY = clippedY + clippedH / 2;

        ctx.fillStyle = ColorUtils.darken(this.box_color, 80);
        ctx.strokeStyle = this.box_color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, half, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    };

    nodeType.prototype.onDrawForeground = function (ctx) {
      if (this.flags.collapsed) return;

      const previewArea = this.getPreviewArea();

      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        previewArea.x,
        previewArea.y,
        previewArea.width,
        previewArea.height
      );

      if (this.imageLoaded) {
        ctx.drawImage(
          this.image,
          previewArea.x,
          previewArea.y,
          previewArea.width,
          previewArea.height
        );
      } else {
        ctx.fillStyle = "#333";
        ctx.fillRect(
          previewArea.x,
          previewArea.y,
          previewArea.width,
          previewArea.height
        );
        ctx.fillStyle = "#666";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          "Out of sync, run Graph to get preview",
          previewArea.x + previewArea.width / 2,
          previewArea.y + previewArea.height / 2 - 20
        );
        ctx.fillText(
          "Crop values reset on sync, so refresh first!",
          previewArea.x + previewArea.width / 2,
          previewArea.y + previewArea.height / 2 + 40
        );
      }

      if (this.dragStart && this.dragEnd) {
        const crop = this.getClippedCropBox();
        if (crop && crop.clippedW > 0 && crop.clippedH > 0) {
          this.drawCropBox(
            ctx,
            previewArea,
            crop.clippedX,
            crop.clippedY,
            crop.clippedW,
            crop.clippedH
          );
        }
      }

      ctx.save();

      ctx.fillStyle = "#777";
      ctx.font = "10px Arial";
      ctx.textAlign = "left";

      const decimalAspectRatio = this.actualImageWidth / this.actualImageHeight;
      let aspectRatio = "";
      if (this.image.src && this.image.complete) {
        aspectRatio = MathUtils.decimalToRatio(decimalAspectRatio);
      }
      // Position text below the preview image with proper bounds checking
      const textStartY = previewArea.y + previewArea.height + 20; // Start text 20px below image

      // Make sure text doesn't overlap with instruction text at bottom
      const maxTextY = this.size[1] - 40; // Leave 40px for instruction text

      if (textStartY < maxTextY) {
        ctx.fillText(
          `Source: ${this.actualImageWidth}×${
            this.actualImageHeight
          } AR: ${decimalAspectRatio.toFixed(2)}:1 (${aspectRatio})`,
          20,
          textStartY
        );

        ctx.fillStyle = "#777";
        ctx.font = "10px Arial";
        ctx.textAlign = "left";

        this.updateCropDisplayValues({ round: true });
        if (this.cropDisplayValues && textStartY + 13 < maxTextY) {
          const decimalAspectRatioCropped =
            this.cropDisplayValues.width / this.cropDisplayValues.height || 1;
          let aspectRatioCropped = "";
          if (this.image.src && this.image.complete) {
            aspectRatioCropped = MathUtils.decimalToRatio(
              decimalAspectRatioCropped
            );
          }
          ctx.fillText(
            `Crop: L: ${this.cropDisplayValues.left} R: ${this.cropDisplayValues.right} T: ${this.cropDisplayValues.top} B: ${this.cropDisplayValues.bottom}`,
            20,
            textStartY + 13  // 13px line spacing
          );

          if (textStartY + 26 < maxTextY) {
            ctx.fillText(
              `Target: ${this.cropDisplayValues.width}×${
                this.cropDisplayValues.height
              } AR: ${decimalAspectRatioCropped.toFixed(
                2
              )}:1 (${aspectRatioCropped})`,
              20,
              textStartY + 26  // 13px line spacing
            );
          }
        }
      }

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      let instructionText = "Drag in the preview to select a crop area.";
      if (this.fixedSizeEnabled) {
        instructionText = `Fixed size mode: ${this.fixedWidth}x${this.fixedHeight} (${this.fixedSizePreset})`;
      }

      ctx.fillText(
        instructionText,
        this.size[0] / 2,
        this.size[1] - 10
      );
      ctx.restore();
    };
  },
});
