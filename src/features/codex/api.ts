import { invoke } from "@tauri-apps/api/core";

import type { CodexAccountSummary } from "@/features/codex/types";

export async function listCodexAccounts() {
  return await invoke<CodexAccountSummary[]>("codex_list_accounts");
}
