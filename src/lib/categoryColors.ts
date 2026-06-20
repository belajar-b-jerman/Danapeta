export const pastelCategoryPalette = [
  "#F3B89A",
  "#A9CFEF",
  "#A8DDB5",
  "#C8B8EA",
  "#F4D35E",
  "#E8AEB7",
  "#9DD9D2",
  "#D8C4A6",
  "#B8C0E0",
  "#F1A7A0",
  "#B5D99C",
  "#F6C177"
];

export function categoryColorAt(index: number) {
  return pastelCategoryPalette[index % pastelCategoryPalette.length];
}
