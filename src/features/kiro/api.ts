import { invoke } from "@tauri-apps/api/core";

import type { KiroAccountSummary } from "@/features/kiro/types";

export async function listKiroAccounts() {
  return await invoke<KiroAccountSummary[]>("kiro_list_accounts");
}

export async function handleKiroCallback(url: string) {
  await invoke<void>("kiro_handle_callback", { url });
}
