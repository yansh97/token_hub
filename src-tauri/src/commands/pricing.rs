use token_proxy_app::app::{
    ModelPricingSettingsInput, ModelPricingSettingsSnapshot, TokenProxyApp,
};

#[tauri::command]
pub async fn read_model_pricing_settings(
    token_proxy_app: tauri::State<'_, TokenProxyApp>,
) -> Result<ModelPricingSettingsSnapshot, String> {
    token_proxy_app.read_model_pricing_settings().await
}

#[tauri::command]
pub async fn save_model_pricing_settings(
    token_proxy_app: tauri::State<'_, TokenProxyApp>,
    settings: ModelPricingSettingsInput,
) -> Result<ModelPricingSettingsSnapshot, String> {
    token_proxy_app.save_model_pricing_settings(settings).await
}

#[tauri::command]
pub async fn reset_model_pricing_settings(
    token_proxy_app: tauri::State<'_, TokenProxyApp>,
) -> Result<ModelPricingSettingsSnapshot, String> {
    token_proxy_app.reset_model_pricing_settings().await
}
