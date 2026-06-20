import { create } from "zustand";
import type { SpendingBehavior, SpendingFrequency } from "../db/schema";

type FilterStore = {
  transactionSearch: string;
  accountIds: string[];
  categoryIds: string[];
  behaviors: SpendingBehavior[];
  frequencies: SpendingFrequency[];
  dateFrom: string;
  dateTo: string;
  setTransactionSearch: (value: string) => void;
  setAccountIds: (value: string[]) => void;
  setCategoryIds: (value: string[]) => void;
  setBehaviors: (value: SpendingBehavior[]) => void;
  setFrequencies: (value: SpendingFrequency[]) => void;
  setDateRange: (dateFrom: string, dateTo: string) => void;
  resetTransactionFilters: () => void;
};

export const useFilterStore = create<FilterStore>((set) => ({
  transactionSearch: "",
  accountIds: [],
  categoryIds: [],
  behaviors: [],
  frequencies: [],
  dateFrom: "",
  dateTo: "",
  setTransactionSearch: (transactionSearch) => set({ transactionSearch }),
  setAccountIds: (accountIds) => set({ accountIds }),
  setCategoryIds: (categoryIds) => set({ categoryIds }),
  setBehaviors: (behaviors) => set({ behaviors }),
  setFrequencies: (frequencies) => set({ frequencies }),
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  resetTransactionFilters: () =>
    set({
      transactionSearch: "",
      accountIds: [],
      categoryIds: [],
      behaviors: [],
      frequencies: [],
      dateFrom: "",
      dateTo: ""
    })
}));
