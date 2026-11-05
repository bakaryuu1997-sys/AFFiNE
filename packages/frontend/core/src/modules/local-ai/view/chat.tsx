import { Button } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type ChatMessage, listModels, streamChat } from '../client';
import { updateLocalAISettings, useLocalAISettings } from '../settings';
import { LocalAISettingsModal } from './settings-modal';
import * as styles from './style.css';

type UIMessage = ChatMessage & { id: number; error?: boolean };

let messageSeq = 0;

export const LocalAIChat = () => {
  const t = useI18n();
  const settings = useLocalAISettings();
  const provider = settings.providers.find(
    p => p.id === settings.activeProviderId
  );

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState<string>();
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const providerId = provider?.id;
  const baseUrl = provider?.baseUrl;
  const apiKey = provider?.apiKey;
  const viaProxy = provider?.viaProxy;
  const savedModel = provider?.model;

  const loadModels = useCallback(async () => {
    if (!provider) return;
    setModelsError(undefined);
    try {
      const list = await listModels(provider, settings.proxyUrl);
      setModels(list);
      if (list.length === 0) {
        setModelsError(t['com.affine.localAI.noModels']());
      } else if (!provider.model || !list.includes(provider.model)) {
        updateLocalAISettings(prev => ({
          ...prev,
          providers: prev.providers.map(p =>
            p.id === provider.id ? { ...p, model: list[0] } : p
          ),
        }));
      }
    } catch (error) {
      setModels([]);
      setModelsError((error as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, baseUrl, apiKey, viaProxy, settings.proxyUrl, t]);

  useEffect(() => {
    loadModels().catch(() => {});
  }, [loadModels]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      if (!provider || !provider.model) {
        setModelsError(
          provider
            ? t['com.affine.localAI.noModels']()
            : t['com.affine.localAI.noProvider']()
        );
        return;
      }

      const userMsg: UIMessage = { id: ++messageSeq, role: 'user', content };
      const replyId = ++messageSeq;
      const history = [...messages, userMsg];
      setMessages([
        ...history,
        { id: replyId, role: 'assistant', content: '' },
      ]);
      setInput('');
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const payload: ChatMessage[] = [
        ...(settings.systemPrompt
          ? [{ role: 'system' as const, content: settings.systemPrompt }]
          : []),
        ...history.map(({ role, content }) => ({ role, content })),
      ];

      try {
        await streamChat({
          provider,
          proxyUrl: settings.proxyUrl,
          model: provider.model,
          messages: payload,
          signal: controller.signal,
          onDelta: delta =>
            setMessages(prev =>
              prev.map(m =>
                m.id === replyId ? { ...m, content: m.content + delta } : m
              )
            ),
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          const message = t['com.affine.localAI.error']({
            message: (error as Error).message,
          });
          setMessages(prev =>
            prev.map(m =>
              m.id === replyId
                ? { ...m, content: m.content || message, error: !m.content }
                : m
            )
          );
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages, provider, settings.proxyUrl, settings.systemPrompt, t]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  const quick = useCallback(
    (instruction: string) => {
      const lastReply = [...messages]
        .reverse()
        .find(m => m.role === 'assistant' && !m.error)?.content;
      const source = input.trim() || lastReply || '';
      if (source) {
        send(`${instruction}:\n\n${source}`).catch(() => {});
      } else {
        setInput(`${instruction}:\n\n`);
      }
    },
    [input, messages, send]
  );

  const quickActions: Array<[string, string]> = [
    [
      t['com.affine.localAI.quick.summarize'](),
      'Hãy tóm tắt nội dung sau, giữ ý chính',
    ],
    [
      t['com.affine.localAI.quick.rewrite'](),
      'Hãy viết lại đoạn sau rõ ràng và mạch lạc hơn, giữ nguyên ý',
    ],
    [
      t['com.affine.localAI.quick.translate.vi'](),
      'Dịch đoạn sau sang tiếng Việt',
    ],
    [
      t['com.affine.localAI.quick.translate.en'](),
      'Translate the following text into English',
    ],
    [
      t['com.affine.localAI.quick.translate.ja'](),
      '次の文章を日本語に翻訳してください',
    ],
  ];

  return (
    <div className={styles.root} data-testid="local-ai-chat">
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          aria-label={t['com.affine.localAI.provider']()}
          value={settings.activeProviderId}
          onChange={e =>
            updateLocalAISettings(prev => ({
              ...prev,
              activeProviderId: e.target.value,
            }))
          }
        >
          {settings.providers.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={t['com.affine.localAI.model']()}
          value={savedModel ?? ''}
          onChange={e =>
            updateLocalAISettings(prev => ({
              ...prev,
              providers: prev.providers.map(p =>
                p.id === providerId ? { ...p, model: e.target.value } : p
              ),
            }))
          }
        >
          {savedModel && !models.includes(savedModel) ? (
            <option value={savedModel}>{savedModel}</option>
          ) : null}
          {models.map(m => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Button
          onClick={() => {
            loadModels().catch(() => {});
          }}
        >
          {t['com.affine.localAI.refreshModels']()}
        </Button>
        <span className={styles.spacer} />
        <Button onClick={clear}>{t['com.affine.localAI.clear']()}</Button>
        <Button onClick={() => setShowSettings(true)}>
          {t['com.affine.localAI.settings']()}
        </Button>
      </div>

      {modelsError ? (
        <div className={styles.column} style={{ paddingTop: 8 }}>
          <span className={styles.bubbleError}>{modelsError}</span>
        </div>
      ) : null}

      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>
              {t['com.affine.localAI.empty.title']()}
            </div>
            {t['com.affine.localAI.empty.desc']()}
          </div>
        ) : (
          <div className={styles.column}>
            {messages.map(m =>
              m.role === 'user' ? (
                <div key={m.id} className={styles.bubbleUser}>
                  {m.content}
                </div>
              ) : (
                <div key={m.id}>
                  <div
                    className={
                      m.error ? styles.bubbleError : styles.bubbleAssistant
                    }
                  >
                    {m.content || (busy ? '…' : '')}
                  </div>
                  {m.content && !m.error ? (
                    <div className={styles.actionsRow}>
                      <button
                        className={styles.chip}
                        onClick={() => {
                          navigator.clipboard
                            ?.writeText(m.content)
                            .catch(() => {});
                        }}
                      >
                        {t['com.affine.localAI.copy']()}
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div className={styles.composer}>
        <div className={styles.column}>
          <div className={styles.chips}>
            {quickActions.map(([label, instruction]) => (
              <button
                key={label}
                className={styles.chip}
                onClick={() => quick(instruction)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.textareaRow}>
            <textarea
              className={styles.textarea}
              value={input}
              placeholder={t['com.affine.localAI.placeholder']()}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send(input).catch(() => {});
                }
              }}
            />
            {busy ? (
              <Button onClick={stop}>{t['com.affine.localAI.stop']()}</Button>
            ) : (
              <Button
                variant="primary"
                disabled={!input.trim()}
                onClick={() => {
                  send(input).catch(() => {});
                }}
              >
                {t['com.affine.localAI.send']()}
              </Button>
            )}
          </div>
        </div>
      </div>

      <LocalAISettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};
