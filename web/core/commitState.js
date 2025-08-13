import { setWidgetValue } from "../utils/nodeUtils.js";

export function commitState(node) {
  setWidgetValue(node, "crop_left", node.properties.crop_left);
  setWidgetValue(node, "crop_right", node.properties.crop_right);
  setWidgetValue(node, "crop_top", node.properties.crop_top);
  setWidgetValue(node, "crop_bottom", node.properties.crop_bottom);
  setWidgetValue(node, "crop_width", node.properties.crop_width);
  setWidgetValue(node, "crop_height", node.properties.crop_height);
}
