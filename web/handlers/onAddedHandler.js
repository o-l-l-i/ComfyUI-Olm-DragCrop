import {
  handleOnMouseDown,
  handleOnMouseLeave,
  handleOnMouseMove,
  handleOnMouseUp,
} from "../core/dragController.js";

import { removeNodeInputs } from "../utils/nodeUtils.js";
import { getPreviewAreaCached } from "../ui/nodeLayout.js";

export function handleOnAdded(node) {
  removeNodeInputs(node);

  const originalOnMouseDown = node.onMouseDown;
  const originalOnMouseMove = node.onMouseMove;
  const originalOnMouseUp = node.onMouseUp;
  const originalOnMouseLeave = node.onMouseLeave;

  node.onMouseDown = function (e, pos, canvas) {
    const preview = getPreviewAreaCached(node);
    const wasHandled = originalOnMouseDown?.call(this, e, pos, canvas);
    if (wasHandled) return true;
    return handleOnMouseDown?.(node, e, pos, canvas, preview);
  };

  node.onMouseMove = function (e, pos, canvas) {
    const preview = getPreviewAreaCached(node);
    const wasHandled = originalOnMouseMove?.call(this, e, pos, canvas);
    if (wasHandled) return true;
    return handleOnMouseMove?.(node, e, pos, canvas, preview);
  };

  node.onMouseUp = function (e, pos, canvas) {
    const preview = getPreviewAreaCached(node);
    const wasHandled = originalOnMouseUp?.call(this, e, pos, canvas);
    if (wasHandled) return true;
    return handleOnMouseUp?.(node, e, pos, canvas, preview);
  };

  node.onMouseLeave = function (e, pos, canvas) {
    const preview = getPreviewAreaCached(node);
    const wasHandled = originalOnMouseLeave?.call(this, e, pos, canvas);
    if (wasHandled) return true;
    return handleOnMouseLeave?.(node, e, preview);
  };
}
