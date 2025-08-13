import { commitState } from "../core/commitState.js";
import { syncCropWidgetsFromProperties } from "../core/cropModel.js";
import { removeNodeInputs } from "../utils/nodeUtils.js";

export function handleOnConfigure(node) {
  removeNodeInputs(node);

  node.forceUpdate();

  syncCropWidgetsFromProperties(node);
  node.updateInfoToggleLabel();

  commitState(node);
}
