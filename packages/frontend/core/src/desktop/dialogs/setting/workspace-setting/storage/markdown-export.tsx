import { notify } from '@affine/component';
import { SettingRow } from '@affine/component/setting-components';
import { Button } from '@affine/component/ui/button';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import {
  type MarkdownExportResult,
  MarkdownExportService,
} from '@affine/core/modules/markdown-export';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useState } from 'react';

export const MarkdownExportPanel = () => {
  const t = useI18n();
  const exporter = useService(MarkdownExportService);
  const [progress, setProgress] = useState<string | null>(null);

  const run = useAsyncCallback(
    async (toFolder: boolean) => {
      if (progress !== null) return;
      setProgress('0');
      try {
        const onProgress = ({ done, total }: { done: number; total: number }) =>
          setProgress(`${done}/${total}`);
        const result: MarkdownExportResult | null = toFolder
          ? await exporter.exportToFolder(onProgress)
          : await exporter.exportToZip(onProgress);
        if (result) {
          notify.success({
            title: t['com.affine.markdownExport.success']({
              count: String(result.exported),
            }),
            message:
              result.skipped > 0
                ? t['com.affine.markdownExport.skipped']({
                    count: String(result.skipped),
                  })
                : undefined,
          });
        }
      } catch (e: any) {
        notify.error({
          title: t['com.affine.markdownExport.failed'](),
          message: e?.message,
        });
      } finally {
        setProgress(null);
      }
    },
    [exporter, progress, t]
  );

  const busy = progress !== null;
  return (
    <SettingRow
      name={t['com.affine.markdownExport.title']()}
      desc={t['com.affine.markdownExport.description']()}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        {exporter.canWriteToFolder ? (
          <Button
            variant="primary"
            data-testid="export-markdown-folder"
            disabled={busy}
            onClick={() => run(true)}
          >
            {busy ? progress : t['com.affine.markdownExport.toFolder']()}
          </Button>
        ) : null}
        <Button
          data-testid="export-markdown-zip"
          disabled={busy}
          onClick={() => run(false)}
        >
          {t['com.affine.markdownExport.toZip']()}
        </Button>
      </div>
    </SettingRow>
  );
};
