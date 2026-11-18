import { Button } from '@affine/component';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type ChatMessage, listModels, streamChat } from '../client';
import { updateLocalAISettings, useLocalAISettings } from '../settings';
import { LocalAISettingsModal } from './settings-modal';
import * as styles from './style.css';

type UIMessage = ChatMessage & { id: number; error?: boolean };

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: UIMessage[];
}

const SESSIONS_STORAGE_KEY = 'affine:local-ai:sessions';
const ACTIVE_SESSION_STORAGE_KEY = 'affine:local-ai:active-session-id';

function loadStoredSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

let messageSeq = Date.now();

export const LocalAIChat = () => {
  const t = useI18n();
  const workspaceDialogService = useService(WorkspaceDialogService);
  const settings = useLocalAISettings();
  const provider = settings.providers.find(
    p => p.id === settings.activeProviderId
  );

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const list = loadStoredSessions();
    if (list.length > 0) return list;
    const initialSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'Cuộc trò chuyện mới',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    saveStoredSessions([initialSession]);
    return [initialSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    const list = loadStoredSessions();
    if (saved && list.some(s => s.id === saved)) return saved;
    return list[0]?.id || `session-${Date.now()}`;
  });

  const [showHistory, setShowHistory] = useState(false);

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );
  const messages = useMemo(
    () => activeSession?.messages || [],
    [activeSession]
  );

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState<string>();
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateActiveMessages = useCallback(
    (updater: (prev: UIMessage[]) => UIMessage[]) => {
      setSessions(prevSessions => {
        const next = prevSessions.map(s => {
          if (s.id !== activeSessionId) return s;
          const newMsgs = updater(s.messages);
          let title = s.title;
          if (title === 'Cuộc trò chuyện mới' && newMsgs.length > 0) {
            const firstUser = newMsgs.find(m => m.role === 'user');
            if (firstUser?.content) {
              title =
                firstUser.content.slice(0, 36).replace(/\n/g, ' ').trim() ||
                'Cuộc trò chuyện';
            }
          }
          return {
            ...s,
            title,
            updatedAt: Date.now(),
            messages: newMsgs,
          };
        });
        saveStoredSessions(next);
        return next;
      });
    },
    [activeSessionId]
  );

  const createNewSession = useCallback(() => {
    abortRef.current?.abort();
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'Cuộc trò chuyện mới',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions(prev => {
      const next = [newSession, ...prev];
      saveStoredSessions(next);
      return next;
    });
    setActiveSessionId(newSession.id);
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, newSession.id);
    setShowHistory(false);
  }, []);

  const selectSession = useCallback((id: string) => {
    abortRef.current?.abort();
    setActiveSessionId(id);
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, id);
    setShowHistory(false);
  }, []);

  const deleteSession = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSessions(prev => {
        const filtered = prev.filter(s => s.id !== id);
        const next =
          filtered.length > 0
            ? filtered
            : [
                {
                  id: `session-${Date.now()}`,
                  title: 'Cuộc trò chuyện mới',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  messages: [],
                },
              ];
        saveStoredSessions(next);
        if (activeSessionId === id) {
          const nextActive = next[0].id;
          setActiveSessionId(nextActive);
          localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, nextActive);
        }
        return next;
      });
    },
    [activeSessionId]
  );

  const clearAllHistory = useCallback(() => {
    abortRef.current?.abort();
    const fresh: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'Cuộc trò chuyện mới',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions([fresh]);
    saveStoredSessions([fresh]);
    setActiveSessionId(fresh.id);
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, fresh.id);
    setShowHistory(false);
  }, []);

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
      updateActiveMessages(() => [
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
            updateActiveMessages(prev =>
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
          updateActiveMessages(prev =>
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
    [
      busy,
      messages,
      provider,
      settings.proxyUrl,
      settings.systemPrompt,
      t,
      updateActiveMessages,
    ]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

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
        <Button variant="primary" onClick={createNewSession}>
          + {t['com.affine.localAI.clear']()}
        </Button>
        <Button onClick={() => setShowHistory(v => !v)}>
          Lịch sử ({sessions.length})
        </Button>
        <Button
          onClick={() =>
            workspaceDialogService.open('setting', { activeTab: 'ai' })
          }
        >
          {t['com.affine.localAI.settings']()}
        </Button>
      </div>

      {showHistory ? (
        <div className={styles.historyDrawer}>
          <div className={styles.historyHeader}>
            <span>Lịch sử trò chuyện</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={styles.chip}
                style={{ fontSize: 11 }}
                onClick={clearAllHistory}
              >
                Xóa hết
              </button>
              <button
                className={styles.chip}
                style={{ fontSize: 11 }}
                onClick={() => setShowHistory(false)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className={styles.historyList}>
            {sessions.map(s => {
              const count = s.messages.length;
              const dateStr = new Date(s.updatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={s.id}
                  className={styles.historyItem}
                  data-active={s.id === activeSessionId}
                  onClick={() => selectSession(s.id)}
                >
                  <span className={styles.historyItemTitle} title={s.title}>
                    {s.title}
                  </span>
                  <span className={styles.historyItemTime}>
                    {count} tin • {dateStr}
                  </span>
                  <button
                    className={styles.historyDeleteBtn}
                    title="Xóa cuộc trò chuyện này"
                    onClick={e => deleteSession(s.id, e)}
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

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
