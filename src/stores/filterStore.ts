import { create } from "zustand";

export interface FilterState {
  search: string;
  status_filter: string;
  platform_id: number;
  task_id: number;
  page: number;
  page_size: number;
  setSearch: (v: string) => void;
  setStatusFilter: (v: string) => void;
  setPlatformId: (v: number) => void;
  setTaskId: (v: number) => void;
  setPage: (v: number) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  search: "",
  status_filter: "",
  platform_id: 0,
  task_id: 0,
  page: 1,
  page_size: 20,

  setSearch: (v) => set({ search: v, page: 1 }),
  setStatusFilter: (v) => set({ status_filter: v, page: 1 }),
  setPlatformId: (v) => set({ platform_id: v, page: 1 }),
  setTaskId: (v) => set({ task_id: v, page: 1 }),
  setPage: (v) => set({ page: v }),
  resetFilters: () =>
    set({ search: "", status_filter: "", platform_id: 0, task_id: 0, page: 1 }),
}));
