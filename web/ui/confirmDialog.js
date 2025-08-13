export function showConfirmDialog(message, onConfirm) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0px";
  overlay.style.left = "0px";
  overlay.style.right = "0px";
  overlay.style.bottom = "0px";
  overlay.style.backgroundColor = "rgba(0,0,0,0.6)";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const dialog = document.createElement("div");
  dialog.style.background = "#222";
  dialog.style.padding = "20px";
  dialog.style.border = "1px solid #444";
  dialog.style.color = "#fff";
  dialog.style.minWidth = "250px";

  const messageText = document.createElement("p");
  messageText.textContent = message;

  const buttonRow = document.createElement("div");
  buttonRow.style.marginTop = "15px";
  buttonRow.style.textAlign = "right";

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "Confirm";
  confirmBtn.onclick = () => {
    cleanup();
    onConfirm(true);
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.marginLeft = "10px";
  cancelBtn.onclick = () => {
    cleanup();
    onConfirm(false);
  };

  function handleKey(event) {
    if (event.key === "Enter") {
      confirmBtn.click();
    } else if (event.key === "Escape") {
      cancelBtn.click();
    }
  }

  function cleanup() {
    document.body.removeChild(overlay);
    document.removeEventListener("keydown", handleKey);
  }

  buttonRow.appendChild(confirmBtn);
  buttonRow.appendChild(cancelBtn);
  dialog.appendChild(messageText);
  dialog.appendChild(buttonRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  document.addEventListener("keydown", handleKey);
  confirmBtn.focus();
}
