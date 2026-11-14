import { notify, Switch } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { Button } from '@affine/component/ui/button';
import {
  listModels,
  testModelConnection,
  type TestModelResult,
} from '@affine/core/modules/local-ai/client';
import {
  type AIProvider,
  updateLocalAISettings,
  useLocalAISettings,
} from '@affine/core/modules/local-ai/settings';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Provider Icons
const ProviderIcon = ({
  providerId,
  size = 18,
}: {
  providerId: string;
  size?: number;
}) => {
  switch (providerId) {
    case 'openai':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#10A37F" strokeWidth="2" />
          <path
            d="M12 7v10M7 12h10"
            stroke="#10A37F"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'anthropic':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M16.5 4.5l-4.5 4.5 4.5 4.5M7.5 4.5l4.5 4.5-4.5 4.5M4 19.5h16"
            stroke="#D97757"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'minimax':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect
            x="3"
            y="6"
            width="18"
            height="12"
            rx="4"
            stroke="#6C6CFF"
            strokeWidth="2"
          />
          <path
            d="M7 12h10"
            stroke="#6C6CFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'openrouter':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L4 7v10l8 5 8-5V7l-8-5z"
            stroke="#9B6DFF"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M12 6l5 3.5v5L12 18l-5-3.5v-5L12 6z"
            fill="#9B6DFF"
            fillOpacity="0.3"
          />
        </svg>
      );
    case 'ollama':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect
            x="5"
            y="8"
            width="14"
            height="12"
            rx="3"
            stroke="#F59E0B"
            strokeWidth="2"
          />
          <circle cx="9" cy="13" r="1.5" fill="#F59E0B" />
          <circle cx="15" cy="13" r="1.5" fill="#F59E0B" />
          <path
            d="M8 5l2 3M16 5l-2 3"
            stroke="#F59E0B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case '9router':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2" />
          <path
            d="M9 9h6v6H9z"
            fill="#3B82F6"
            fillOpacity="0.4"
            stroke="#3B82F6"
            strokeWidth="1.5"
          />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8 12h8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};

export const AiSettingsPanel = () => {
  const settings = useLocalAISettings();
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    settings.activeProviderId || settings.providers[0]?.id || 'ollama'
  );

  const activeProvider = useMemo(
    () =>
      settings.providers.find(p => p.id === selectedProviderId) ??
      settings.providers[0],
    [settings.providers, selectedProviderId]
  );

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<TestModelResult | null>(null);

  // Load models for the selected provider
  const fetchModelsForProvider = useCallback(
    async (provider: AIProvider, force = false) => {
      setLoadingModels(true);
      try {
        const list = await listModels(provider, settings.proxyUrl);
        setAvailableModels(list);
        if (force) {
          notify.success({
            title: `Đã tìm thấy ${list.length} mô hình`,
          });
        }
      } catch (err) {
        if (force) {
          notify.error({
            title: 'Không thể tải danh sách mô hình',
            message: (err as Error)?.message,
          });
        }
      } finally {
        setLoadingModels(false);
      }
    },
    [settings.proxyUrl]
  );

  useEffect(() => {
    if (activeProvider) {
      fetchModelsForProvider(activeProvider).catch(console.error);
      setIsEditingKey(false);
      setKeyInput('');
      setTestResult(null);
    }
  }, [activeProvider, fetchModelsForProvider]);

  const handleSelectDefaultProvider = (providerId: string) => {
    setSelectedProviderId(providerId);
    updateLocalAISettings(prev => ({
      ...prev,
      activeProviderId: providerId,
    }));
  };

  const handleSaveKey = () => {
    if (!activeProvider) return;
    const trimmed = keyInput.trim();
    updateLocalAISettings(prev => ({
      ...prev,
      providers: prev.providers.map(p =>
        p.id === activeProvider.id ? { ...p, apiKey: trimmed } : p
      ),
    }));
    setIsEditingKey(false);
    setKeyInput('');
    notify.success({ title: 'Đã lưu API Key an toàn' });
  };

  const handleResetKey = () => {
    if (!activeProvider) return;
    updateLocalAISettings(prev => ({
      ...prev,
      providers: prev.providers.map(p =>
        p.id === activeProvider.id ? { ...p, apiKey: '' } : p
      ),
    }));
    setIsEditingKey(false);
    setKeyInput('');
    notify.success({ title: 'Đã đặt lại API Key' });
  };

  const handleUpdateUrl = (baseUrl: string) => {
    if (!activeProvider) return;
    updateLocalAISettings(prev => ({
      ...prev,
      providers: prev.providers.map(p =>
        p.id === activeProvider.id ? { ...p, baseUrl: baseUrl.trim() } : p
      ),
    }));
  };

  const handleSelectModel = (model: string) => {
    if (!activeProvider) return;
    updateLocalAISettings(prev => ({
      ...prev,
      providers: prev.providers.map(p =>
        p.id === activeProvider.id ? { ...p, model } : p
      ),
    }));
    setTestResult(null);
  };

  const handleTestModel = async () => {
    if (!activeProvider) return;
    const modelToTest = activeProvider.model || availableModels[0] || 'default';
    setTestingModel(true);
    setTestResult(null);
    try {
      const res = await testModelConnection(
        activeProvider,
        settings.proxyUrl,
        modelToTest
      );
      setTestResult(res);
    } finally {
      setTestingModel(false);
    }
  };

  const isConfigured = Boolean(
    activeProvider?.apiKey ||
    activeProvider?.id === 'ollama' ||
    activeProvider?.id === '9router'
  );

  return (
    <>
      <SettingHeader
        title="Cài đặt AI"
        subtitle="Quản lý nhà cung cấp mô hình ngôn ngữ lớn (LLM) và cấu hình trợ lý AI cục bộ."
      />

      <SettingWrapper>
        {/* Toggle AI */}
        <SettingRow
          name="Bật trợ lý AI"
          desc="Hiển thị nút Trí tuệ trên thanh bên và các công cụ hỗ trợ AI cục bộ trong trình soạn thảo."
        >
          <Switch
            checked={settings.enabled}
            onChange={enabled =>
              updateLocalAISettings(prev => ({ ...prev, enabled }))
            }
          />
        </SettingRow>

        {/* Section: NHÀ CUNG CẤP MẶC ĐỊNH */}
        <div
          style={{
            marginTop: 20,
            marginBottom: 8,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--affine-text-secondary-color)',
            letterSpacing: 0.5,
          }}
        >
          NHÀ CUNG CẤP MẶC ĐỊNH
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
            marginBottom: 24,
          }}
        >
          {settings.providers.map(p => {
            const isSelected = p.id === selectedProviderId;
            const pConfigured = Boolean(
              p.apiKey || p.id === 'ollama' || p.id === '9router'
            );
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectDefaultProvider(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: isSelected
                    ? '1.5px solid var(--affine-primary-color)'
                    : '1px solid var(--affine-border-color)',
                  background: isSelected
                    ? 'var(--affine-hover-color)'
                    : 'var(--affine-background-primary-color)',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ProviderIcon providerId={p.id} size={18} />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--affine-text-primary-color)',
                    }}
                  >
                    {p.name}
                  </span>
                </div>
                {pConfigured && (
                  <span
                    style={{
                      color: isSelected
                        ? 'var(--affine-primary-color)'
                        : '#10B981',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Provider Details */}
        {activeProvider && (
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              border: '1px solid var(--affine-border-color)',
              background: 'var(--affine-background-primary-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Header with status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--affine-border-color)',
                paddingBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ProviderIcon providerId={activeProvider.id} size={22} />
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--affine-text-primary-color)',
                  }}
                >
                  {activeProvider.name}
                </span>
                {isConfigured ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#10B981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    ✓ Đã cấu hình
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--affine-text-secondary-color)',
                      background: 'var(--affine-background-secondary-color)',
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: '1px solid var(--affine-border-color)',
                    }}
                  >
                    Chưa cấu hình
                  </span>
                )}
              </div>
            </div>

            {/* API Key */}
            {activeProvider.id !== 'ollama' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--affine-text-secondary-color)',
                  }}
                >
                  API Key của {activeProvider.name}
                </label>

                {activeProvider.apiKey && !isEditingKey ? (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <div
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontFamily: 'monospace',
                        letterSpacing: 2,
                        background: 'var(--affine-background-secondary-color)',
                        border: '1px solid var(--affine-border-color)',
                        color: 'var(--affine-text-primary-color)',
                        fontSize: 13,
                      }}
                    >
                      ••••••••••••••••••••••••
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setIsEditingKey(true)}
                    >
                      Đổi
                    </Button>
                    <Button variant="secondary" onClick={handleResetKey}>
                      Đặt lại
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={keyInput}
                        placeholder={`Nhập API key của ${activeProvider.name}…`}
                        onChange={e => setKeyInput(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 36px 8px 12px',
                          borderRadius: 6,
                          fontSize: 13,
                          background:
                            'var(--affine-background-secondary-color)',
                          border: '1px solid var(--affine-border-color)',
                          color: 'var(--affine-text-primary-color)',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--affine-text-secondary-color)',
                          fontSize: 12,
                        }}
                      >
                        {showKey ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleSaveKey}
                      disabled={!keyInput.trim()}
                    >
                      Lưu
                    </Button>
                    {isEditingKey && (
                      <Button
                        variant="secondary"
                        onClick={() => setIsEditingKey(false)}
                      >
                        Hủy
                      </Button>
                    )}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--affine-text-secondary-color)',
                  }}
                >
                  API Key được lưu trữ cục bộ trên máy của bạn và chỉ gửi trực
                  tiếp tới máy chủ của nhà cung cấp.
                </div>
              </div>
            )}

            {/* URL Endpoint */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--affine-text-secondary-color)',
                }}
              >
                URL Endpoint
              </label>
              <input
                type="text"
                value={activeProvider.baseUrl}
                onChange={e => handleUpdateUrl(e.target.value)}
                placeholder="https://api.openai.com/v1 hoặc http://localhost:11434/v1"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  background: 'var(--affine-background-secondary-color)',
                  border: '1px solid var(--affine-border-color)',
                  color: 'var(--affine-text-primary-color)',
                  outline: 'none',
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--affine-text-secondary-color)',
                }}
              >
                URL gốc của API tương thích OpenAI. Ví dụ:
                https://api.openai.com/v1, http://localhost:11434/v1, https://openrouter.ai/api/v1
              </div>
            </div>

            {/* Default Model */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--affine-text-secondary-color)',
                  }}
                >
                  Mô hình mặc định
                </label>
                {availableModels.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--affine-text-secondary-color)',
                    }}
                  >
                    {availableModels.length} mô hình khả dụng
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={activeProvider.model || availableModels[0] || ''}
                  onChange={e => handleSelectModel(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    background: 'var(--affine-background-secondary-color)',
                    border: '1px solid var(--affine-border-color)',
                    color: 'var(--affine-text-primary-color)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {availableModels.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  {!availableModels.includes(activeProvider.model || '') &&
                    activeProvider.model && (
                      <option value={activeProvider.model}>
                        {activeProvider.model}
                      </option>
                    )}
                </select>

                <Button
                  variant="secondary"
                  disabled={loadingModels}
                  onClick={() => {
                    fetchModelsForProvider(activeProvider, true).catch(
                      console.error
                    );
                  }}
                >
                  {loadingModels ? 'Đang tìm...' : '🔄 Tải lại'}
                </Button>

                <Button
                  variant="secondary"
                  disabled={testingModel}
                  onClick={() => {
                    handleTestModel().catch(console.error);
                  }}
                >
                  {testingModel ? 'Đang thử...' : '⚡ Thử model'}
                </Button>
              </div>

              {testResult && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    background: testResult.success
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'rgba(239, 68, 68, 0.08)',
                    border: testResult.success
                      ? '1px solid rgba(16, 185, 129, 0.2)'
                      : '1px solid rgba(239, 68, 68, 0.2)',
                    color: testResult.success ? '#10B981' : '#EF4444',
                  }}
                >
                  {testResult.success
                    ? `✓ ${testResult.message}`
                    : `✗ Lỗi kiểm tra: ${testResult.message}`}
                </div>
              )}
            </div>

            {/* Prompt Customization */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                borderTop: '1px solid var(--affine-border-color)',
                paddingTop: 14,
              }}
            >
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--affine-text-secondary-color)',
                }}
              >
                Tùy chỉnh Prompt hệ thống
              </label>
              <textarea
                rows={3}
                value={settings.systemPrompt}
                onChange={e =>
                  updateLocalAISettings(prev => ({
                    ...prev,
                    systemPrompt: e.target.value,
                  }))
                }
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  lineHeight: 1.5,
                  background: 'var(--affine-background-secondary-color)',
                  border: '1px solid var(--affine-border-color)',
                  color: 'var(--affine-text-primary-color)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        )}
      </SettingWrapper>
    </>
  );
};
