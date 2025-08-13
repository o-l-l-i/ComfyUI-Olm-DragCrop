export const ColorUtils = {
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
