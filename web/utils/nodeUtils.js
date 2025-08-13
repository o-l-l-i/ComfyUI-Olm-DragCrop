export function getWidget(node, name) {
  return node.widgets.find((w) => w.name === name);
}

export function getWidgetValue(node, name, fallback = null) {
  return node.widgets.find((w) => w.name === name)?.value || fallback;
}

export function setWidgetValue(node, name, val) {
  const widget = getWidget(node, name);
  if (widget && val !== null && val !== undefined) {
    widget.value = Math.round(val);
  }
}

export function getWidgetValSafe(node, name) {
  const widget = getWidget(node, name);
  return widget ? widget.value : null;
}

export function hideWidget(widget, extraYOffset = -4) {
  if (widget) {
    widget.hidden = true;
    widget.computeSize = () => [0, extraYOffset];
  }
}

export function removeInputs(node, nodeType, filter) {
  if (
    !node ||
    node.type !== nodeType ||
    node.id === -1 ||
    !Array.isArray(node.inputs)
  ) {
    return;
  }
  for (let i = node.inputs.length - 1; i >= 0; i--) {
    if (filter(node.inputs[i])) {
      try {
        node.removeInput(i);
      } catch (error) {
        console.warn(
          `[${nodeType}] Node ${node.id}: skipping input removal (graph not ready):`,
          node.inputs[i].name
        );
      }
    }
  }
}

export function removeNodeInputs(node) {
  removeInputs(node, "OlmDragCrop", (input) =>
    [
      "drawing_version",
      "crop_width",
      "crop_height",
      "last_width",
      "last_height",
    ].includes(input.name)
  );
}

export function applyBox(node, patch) {
  if (patch) {
    const dragStart = patch.dragStart ?? patch.newStart;
    const dragEnd = patch.dragEnd ?? patch.newEnd;
    if (dragStart && dragEnd) {
      node.properties.dragStart = dragStart;
      node.properties.dragEnd = dragEnd;
    }
  }
}
