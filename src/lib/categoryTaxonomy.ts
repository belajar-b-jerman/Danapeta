import type { SpendingBehavior } from "../db/schema";
import { categoryColorAt } from "./categoryColors";

export type CategorySeed = {
  name: string;
  defaultBehavior: SpendingBehavior;
  budgetGroup: "daily" | "commitment" | "sinking_fund" | "flexible" | "giving" | "work";
  color: string;
  icon: string;
  subcategories: Array<{
    name: string;
    defaultBehavior?: SpendingBehavior;
  }>;
};

export const expenseCategorySeeds: CategorySeed[] = [
  {
    name: "Makan",
    defaultBehavior: "variable",
    budgetGroup: "daily",
    color: categoryColorAt(0),
    icon: "utensils",
    subcategories: [
      { name: "Sarapan" },
      { name: "Makan Siang" },
      { name: "Makan Malam" },
      { name: "Jajan", defaultBehavior: "impulse" },
      { name: "Kopi", defaultBehavior: "impulse" },
      { name: "Bahan Masak" },
      { name: "Buah" }
    ]
  },
  {
    name: "Transportasi",
    defaultBehavior: "variable",
    budgetGroup: "flexible",
    color: categoryColorAt(1),
    icon: "car",
    subcategories: [
      { name: "Bensin Mobil" },
      { name: "Bensin Motor" },
      { name: "Parkir" },
      { name: "Transport Online" },
      { name: "Tol" }
    ]
  },
  {
    name: "Rumah Tangga",
    defaultBehavior: "variable",
    budgetGroup: "flexible",
    color: categoryColorAt(2),
    icon: "home",
    subcategories: [
      { name: "Perlengkapan" },
      { name: "Peralatan" },
      { name: "Maintenance" },
      { name: "Kebersihan" }
    ]
  },
  {
    name: "Tagihan",
    defaultBehavior: "fixed",
    budgetGroup: "commitment",
    color: categoryColorAt(3),
    icon: "receipt",
    subcategories: [
      { name: "Listrik" },
      { name: "Air" },
      { name: "Internet" },
      { name: "Pulsa/Data" }
    ]
  },
  {
    name: "Anak & Pendidikan",
    defaultBehavior: "fixed",
    budgetGroup: "commitment",
    color: categoryColorAt(4),
    icon: "school",
    subcategories: [
      { name: "SPP" },
      { name: "Kegiatan Sekolah" },
      { name: "Iuran Sekolah" },
      { name: "Perlengkapan Anak", defaultBehavior: "mandatory" },
      { name: "Acara Anak", defaultBehavior: "planned" }
    ]
  },
  {
    name: "Keluarga",
    defaultBehavior: "variable",
    budgetGroup: "sinking_fund",
    color: categoryColorAt(5),
    icon: "users",
    subcategories: [
      { name: "Bulanan Keluarga", defaultBehavior: "fixed" },
      { name: "Kebutuhan Keluarga" },
      { name: "Acara Keluarga", defaultBehavior: "planned" }
    ]
  },
  {
    name: "Kesehatan",
    defaultBehavior: "mandatory",
    budgetGroup: "commitment",
    color: categoryColorAt(6),
    icon: "heart-pulse",
    subcategories: [
      { name: "Obat" },
      { name: "Konsultasi" },
      { name: "Vitamin" },
      { name: "Perawatan" }
    ]
  },
  {
    name: "Lifestyle",
    defaultBehavior: "variable",
    budgetGroup: "flexible",
    color: categoryColorAt(7),
    icon: "sparkles",
    subcategories: [
      { name: "Fashion" },
      { name: "Liburan", defaultBehavior: "planned" },
      { name: "Hiburan" },
      { name: "Self-Care" }
    ]
  },
  {
    name: "Supermarket",
    defaultBehavior: "variable",
    budgetGroup: "daily",
    color: categoryColorAt(8),
    icon: "shopping-basket",
    subcategories: [
      { name: "Belanja Bulanan" },
      { name: "Bahan Pokok" },
      { name: "Kebutuhan Dapur" }
    ]
  },
  {
    name: "Perumahan",
    defaultBehavior: "fixed",
    budgetGroup: "commitment",
    color: categoryColorAt(9),
    icon: "building-2",
    subcategories: [
      { name: "Iuran Lingkungan" },
      { name: "Perbaikan Rumah", defaultBehavior: "variable" },
      { name: "Sewa/Cicilan" }
    ]
  },
  {
    name: "Sosial & Keagamaan",
    defaultBehavior: "planned",
    budgetGroup: "giving",
    color: categoryColorAt(10),
    icon: "hand-heart",
    subcategories: [
      { name: "Donasi" },
      { name: "Iuran Sosial" },
      { name: "Keagamaan" }
    ]
  },
  {
    name: "Kerja",
    defaultBehavior: "variable",
    budgetGroup: "work",
    color: categoryColorAt(11),
    icon: "briefcase",
    subcategories: [
      { name: "Perlengkapan Kerja" },
      { name: "Makan Kerja" },
      { name: "Transport Kerja" }
    ]
  }
];
