export const MathUtils = {
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
