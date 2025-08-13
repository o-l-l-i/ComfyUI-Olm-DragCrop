export const DEFAULT_SIZE = 512;
export const MIN_CROP_DIMENSION = 1;
export const DEFAULT_SNAP_VALUE = "none";
export const DEFAULT_COLOR = "Lime";
export const WIDGET_ROW_H = 25;

export const colorOptions = [
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

export const LAYOUT = {
  PADDING_X: 40,
  PADDING_Y: 10,
  HEADER_H: 85,
  INSTRUCTIONS_H: 20,
  WIDGET_ROW_H: 25,
  PREVIEW_MIN_W: 160,
  PREVIEW_MAX_W: 1024,
  DEFAULT_PREVIEW_W: 320,
  DEFAULT_PREVIEW_SCALE: 0.33,
};

export const GRAPHICS = {
  handleSize: 4,
  handleLineWidth: 1,
  darkenFactor: 80,
  border: "#555",
  borderLineWidth: 1,
  colorDim: "#777",
  colorDimFill: "#333",
  croppedDarken: "rgba(0, 0, 0, 0.65)",
  cropLineWidth: 1,
};

export const TEXT = {
  cropBoxFont: "12px Arial",
  fontSmall: "10px Arial",
  colorFontSmall: "#aaa",
  fontMedium: "12px Arial",
  colorDimText: "#666",
  fontMessage: "14px Arial",
};

export const TEXTCONTENT = {
  aspectStringMsg: "Use values like 0.5 or 16:9",
  imageAreaInfoMsgRow1: "Out of sync, run Graph to get preview",
  imageAreaInfoMsgRow2: "Crop values reset on sync, so refresh first!",
  usageInstructionMsg: "Drag in the preview to select a crop area.",
  setRatiofromCropDlg:
    "⚠️ Use the current crop box dimensions to set the aspect ratio?",
  resetCropDlg: "⚠️ Are you sure you want to reset the crop?",
  snapToWidget: "Snap to",
  aspectRatioWidget: "Aspect Ratio",
  aspectRatioLockWidget: "Aspect Ratio Lock",
  setRatioFromCropWidget: "Set Ratio from Crop",
  forceRefreshWidget: "Force Refresh",
  infoTextToggleWidgetHide: "Hide Info Text",
  infoTextToggleWidgetShow: "Show Info Text",
  boxColorWidget: "Box Color",
  resetCropWidget: "Reset Crop",
};
