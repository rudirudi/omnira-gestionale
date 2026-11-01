"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-9 items-center gap-2 rounded-lg bg-[#1F4196] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#19357a]"
    >
      <Printer className="size-4" /> Stampa o salva PDF
    </button>
  );
}
