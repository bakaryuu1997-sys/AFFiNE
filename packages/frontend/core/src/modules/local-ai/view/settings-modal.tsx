import { Button } from '@affine/component';
import { Modal } from '@affine/component/ui/modal';
import { useI18n } from '@affine/i18n';
import { useCallback, useState } from 'react';

import { listModels } from '../client';
import {
  type AIProvider,
  newProviderId,
  updateLocalAISettings,
  useLocalAISettings,
} from '../settings';
import * as styles from './style.css';

type TestState = { ok: boolean; text: string } | 'pending' | undefined;

const ProviderCard = ({ provider }: { provider: AIProvider }) => {
  const t = useI18n();
  const { proxyUrl } = useLocalAISettings();
  const [test, setTest] = useState<TestState>();

  const patch = useCallback(
    (changes: Partial<AIProvider>) =>
      updateLocalAISettings(prev => ({
        ...prev,
        providers: prev.providers.map(p =>
          p.id === provider.id ? { ...p, ...changes } : p
        ),
      })),
    [provider.id]
  );

  const remove = useCallback(
    () =>
      updateLocalAISettings(prev => {
        const providers = prev.providers.filter(p => p.id !== provider.id);
        return {
          ...prev,
          providers,
          activeProviderId:
            prev.activeProviderId === provider.id
              ? (providers[0]?.id ?? '')
              : prev.activeProviderId,
        };
      }),
    [provider.id]
  );

  const runTest = useCallback(async () => {
    setTest('pending');
    try {
      const models = await listModels(provider, proxyUrl);
      setTest({
        ok: true,
        text: t['com.affine.localAI.settings.testOk']({
          count: String(models.length),
        }),
      });
    } catch (error) {
      setTest({ ok: false, text: (error as Error).message });
    }
  }, [provider, proxyUrl, t]);

  return (
    <div className={styles.providerCard} data-testid="local-ai-provider">
      <label className={styles.field}>
        {t['com.affine.localAI.settings.name']()}
        <input
          className={styles.input}
          value={provider.name}
          onChange={e => patch({ name: e.target.value })}
        />
      </label>
      <label className={styles.field}>
        {t['com.affine.localAI.settings.baseUrl']()}
        <input
          className={styles.input}
          value={provider.baseUrl}
          placeholder="http://localhost:11434/v1"
          onChange={e => patch({ baseUrl: e.target.value })}
        />
      </label>
      <label className={styles.field}>
        {t['com.affine.localAI.settings.apiKey']()}
        <input
          className={styles.input}
          type="password"
          autoComplete="off"
          value={provider.apiKey}
          onChange={e => patch({ apiKey: e.target.value })}
        />
      </label>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={provider.viaProxy}
          onChange={e => patch({ viaProxy: e.target.checked })}
        />
        {t['com.affine.localAI.settings.viaProxy']()}
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button
          onClick={() => {
            runTest().catch(() => {});
          }}
          loading={test === 'pending'}
        >
          {t['com.affine.localAI.settings.test']()}
        </Button>
        <Button variant="secondary" onClick={remove}>
          {t['com.affine.localAI.settings.remove']()}
        </Button>
        {test && test !== 'pending' ? (
          <span className={test.ok ? styles.statusOk : styles.statusErr}>
            {test.text}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export const LocalAISettingsModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const t = useI18n();
  const settings = useLocalAISettings();

  const addProvider = useCallback(
    () =>
      updateLocalAISettings(prev => {
        const id = newProviderId();
        return {
          ...prev,
          providers: [
            ...prev.providers,
            {
              id,
              name: 'OpenAI-compatible',
              baseUrl: 'https://',
              apiKey: '',
              viaProxy: false,
            },
          ],
          activeProviderId: prev.activeProviderId || id,
        };
      }),
    []
  );

  return (
    <Modal
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
      title={t['com.affine.localAI.settings.title']()}
      width={560}
    >
      <div className={styles.settingsBody}>
        <span className={styles.hint}>
          {t['com.affine.localAI.settings.keyHint']()}
        </span>
        {settings.providers.map(p => (
          <ProviderCard key={p.id} provider={p} />
        ))}
        <Button onClick={addProvider}>
          {t['com.affine.localAI.settings.add']()}
        </Button>
        <label className={styles.field}>
          {t['com.affine.localAI.settings.proxyUrl']()}
          <input
            className={styles.input}
            value={settings.proxyUrl}
            onChange={e =>
              updateLocalAISettings(prev => ({
                ...prev,
                proxyUrl: e.target.value,
              }))
            }
          />
        </label>
        <label className={styles.field}>
          {t['com.affine.localAI.settings.systemPrompt']()}
          <textarea
            className={styles.textarea}
            value={settings.systemPrompt}
            onChange={e =>
              updateLocalAISettings(prev => ({
                ...prev,
                systemPrompt: e.target.value,
              }))
            }
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={onClose}>
            {t['com.affine.localAI.settings.done']()}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
