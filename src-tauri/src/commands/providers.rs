use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::{proxy, xai};

use token_proxy_accounts::provider_accounts::{
    ProviderAccountKind, ProviderAccountListItem, ProviderAccountsQueryParams,
};

#[derive(Debug, Default, PartialEq, Eq)]
struct ProviderAccountDeletePlan {
    xai_account_ids: Vec<String>,
    generic_account_ids: Vec<String>,
}

fn build_provider_account_delete_plan(
    account_ids: Vec<String>,
    items: &[ProviderAccountListItem],
) -> ProviderAccountDeletePlan {
    let provider_kind_by_id = items
        .iter()
        .map(|item| (item.account_id.as_str(), item.provider_kind))
        .collect::<HashMap<_, _>>();
    let mut seen = HashSet::new();
    let mut plan = ProviderAccountDeletePlan::default();
    for account_id in account_ids {
        let account_id = account_id.trim();
        if account_id.is_empty() || !seen.insert(account_id.to_string()) {
            continue;
        }
        if provider_kind_by_id.get(account_id) == Some(&ProviderAccountKind::Xai) {
            plan.xai_account_ids.push(account_id.to_string());
        } else {
            // 未找到的 ID 保留旧语义：交给通用 DELETE 幂等处理。
            plan.generic_account_ids.push(account_id.to_string());
        }
    }
    plan
}

async fn apply_runtime_account_cooldowns(
    proxy_service: proxy::service::ProxyServiceHandle,
    items: &mut [token_proxy_accounts::provider_accounts::ProviderAccountListItem],
) {
    let kiro_account_ids = items
        .iter()
        .filter(|item| {
            item.provider_kind == token_proxy_accounts::provider_accounts::ProviderAccountKind::Kiro
                && item.status
                    == token_proxy_accounts::provider_accounts::ProviderAccountStatus::Active
        })
        .map(|item| item.account_id.clone())
        .collect::<Vec<_>>();
    let codex_account_ids = items
        .iter()
        .filter(|item| {
            item.provider_kind
                == token_proxy_accounts::provider_accounts::ProviderAccountKind::Codex
                && item.status
                    == token_proxy_accounts::provider_accounts::ProviderAccountStatus::Active
        })
        .map(|item| item.account_id.clone())
        .collect::<Vec<_>>();
    let xai_account_ids = items
        .iter()
        .filter(|item| {
            item.provider_kind == token_proxy_accounts::provider_accounts::ProviderAccountKind::Xai
                && item.status
                    == token_proxy_accounts::provider_accounts::ProviderAccountStatus::Active
        })
        .map(|item| item.account_id.clone())
        .collect::<Vec<_>>();
    // 三类账户冷却查询互不依赖，并行读取运行时状态，避免账户页延迟随 provider 数增长。
    let (cooling_kiro, cooling_codex, cooling_xai) = tokio::join!(
        proxy_service.cooling_account_ids("kiro", &kiro_account_ids),
        proxy_service.cooling_account_ids("codex", &codex_account_ids),
        proxy_service.cooling_account_ids("xai", &xai_account_ids),
    );

    for item in items.iter_mut() {
        if item.status != token_proxy_accounts::provider_accounts::ProviderAccountStatus::Active {
            continue;
        }
        let is_cooling = match item.provider_kind {
            token_proxy_accounts::provider_accounts::ProviderAccountKind::Kiro => {
                cooling_kiro.contains(&item.account_id)
            }
            token_proxy_accounts::provider_accounts::ProviderAccountKind::Codex => {
                cooling_codex.contains(&item.account_id)
            }
            token_proxy_accounts::provider_accounts::ProviderAccountKind::Xai => {
                cooling_xai.contains(&item.account_id)
            }
        };
        if is_cooling {
            item.status =
                token_proxy_accounts::provider_accounts::ProviderAccountStatus::CoolingDown;
        }
    }
}

#[tauri::command]
pub async fn providers_list_accounts_page(
    paths: tauri::State<'_, Arc<token_proxy_account_store::paths::TokenProxyPaths>>,
    proxy_service: tauri::State<'_, proxy::service::ProxyServiceHandle>,
    page: u32,
    page_size: u32,
    provider_kind: Option<String>,
    status: Option<String>,
    search: Option<String>,
) -> Result<token_proxy_accounts::provider_accounts::ProviderAccountsPage, String> {
    let provider_kind = provider_kind
        .as_deref()
        .map(token_proxy_accounts::provider_accounts::ProviderAccountKind::parse)
        .transpose()?;
    let status = status
        .as_deref()
        .map(token_proxy_accounts::provider_accounts::ProviderAccountStatus::parse)
        .transpose()?;

    let mut items = token_proxy_accounts::provider_accounts::list_accounts_snapshot(
        paths.inner().as_ref(),
        token_proxy_accounts::provider_accounts::ProviderAccountsQueryParams {
            provider_kind,
            search: search.unwrap_or_default(),
        },
    )
    .await?;
    apply_runtime_account_cooldowns(proxy_service.inner().clone(), &mut items).await;
    let status_counts =
        token_proxy_accounts::provider_accounts::ProviderAccountStatusCounts::from_items(&items);
    if let Some(status) = status {
        items.retain(|item| item.status == status);
    }

    let page = page.max(1);
    let page_size = page_size.clamp(1, token_proxy_accounts::provider_accounts::MAX_PAGE_SIZE);
    let total = u32::try_from(items.len()).unwrap_or(u32::MAX);
    let start = usize::try_from((page - 1) * page_size).unwrap_or(usize::MAX);
    let end = start.saturating_add(usize::try_from(page_size).unwrap_or(usize::MAX));
    let items = if start >= items.len() {
        Vec::new()
    } else {
        items[start..items.len().min(end)].to_vec()
    };

    Ok(
        token_proxy_accounts::provider_accounts::ProviderAccountsPage {
            items,
            total,
            page,
            page_size,
            status_counts,
        },
    )
}

#[tauri::command]
pub async fn providers_delete_accounts(
    paths: tauri::State<'_, Arc<token_proxy_account_store::paths::TokenProxyPaths>>,
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    account_ids: Vec<String>,
) -> Result<(), String> {
    let items = token_proxy_accounts::provider_accounts::list_accounts_snapshot(
        paths.inner().as_ref(),
        ProviderAccountsQueryParams {
            provider_kind: None,
            search: String::new(),
        },
    )
    .await?;
    let plan = build_provider_account_delete_plan(account_ids, &items);
    tracing::info!(
        xai_accounts = plan.xai_account_ids.len(),
        generic_accounts = plan.generic_account_ids.len(),
        "provider account batch delete planned"
    );

    // xAI 必须进入 Store 的 mutation/cache 边界，避免与 refresh 交错后被旧快照重新 UPSERT。
    for account_id in &plan.xai_account_ids {
        xai_store.delete_account(account_id).await?;
    }
    token_proxy_accounts::provider_accounts::delete_accounts(
        paths.inner().as_ref(),
        &plan.generic_account_ids,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use token_proxy_accounts::provider_accounts::{
        ProviderAccountQuotaSnapshot, ProviderAccountStatus,
    };

    fn account(provider_kind: ProviderAccountKind, account_id: &str) -> ProviderAccountListItem {
        ProviderAccountListItem {
            provider_kind,
            account_id: account_id.to_string(),
            email: None,
            expires_at: None,
            priority: 0,
            status: ProviderAccountStatus::Active,
            auth_method: None,
            provider_name: None,
            auto_refresh_enabled: None,
            proxy_url: None,
            quota: ProviderAccountQuotaSnapshot::default(),
        }
    }

    #[test]
    fn batch_delete_routes_xai_through_store_and_deduplicates_ids() {
        let items = vec![
            account(ProviderAccountKind::Xai, "xai-user"),
            account(ProviderAccountKind::Codex, "codex-user"),
        ];

        let plan = build_provider_account_delete_plan(
            vec![
                " xai-user ".to_string(),
                "codex-user".to_string(),
                "xai-user".to_string(),
                "missing-user".to_string(),
                " ".to_string(),
            ],
            &items,
        );

        assert_eq!(plan.xai_account_ids, vec!["xai-user"]);
        assert_eq!(plan.generic_account_ids, vec!["codex-user", "missing-user"]);
    }
}
