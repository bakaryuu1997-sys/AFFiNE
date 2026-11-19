import {
  Button,
  IconButton,
  Loading,
  Menu,
  MenuItem,
  notify,
  Skeleton,
  useConfirmModal,
} from '@affine/component';
import {
  Pagination,
  SettingHeader,
  SettingRow,
} from '@affine/component/setting-components';
import { Avatar } from '@affine/component/ui/avatar';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { useNavigateHelper } from '@affine/core/components/hooks/use-navigate-helper';
import {
  type BackupStatus,
  fetchBackupStatus,
  openBackupFolder,
  runAutoBackupNow,
} from '@affine/core/modules/backup/auto-backup';
import { BackupService } from '@affine/core/modules/backup/services';
import { MarkdownExportService } from '@affine/core/modules/markdown-export';
import { toArrayBuffer } from '@affine/core/utils/array-buffer';
import { i18nTime, useI18n } from '@affine/i18n';
import track from '@affine/track';
import {
  DeleteIcon,
  LocalWorkspaceIcon,
  MoreVerticalIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import bytes from 'bytes';
import { useCallback, useEffect, useMemo, useState } from 'react';

import * as styles from './styles.css';

const AutoBackupSection = () => {
  const markdownExportService = useService(MarkdownExportService);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  const refreshStatus = useCallback(async () => {
    const s = await fetchBackupStatus();
    if (s) setStatus(s);
  }, []);

  useEffect(() => {
    refreshStatus().catch(console.error);
  }, [refreshStatus]);

  const handleBackupNow = async () => {
    if (backingUp) return;
    setBackingUp(true);
    try {
      const res = await runAutoBackupNow(markdownExportService);
      if (res.success) {
        notify.success({
          title: `Đã sao lưu thành công ${res.files_written} tệp!`,
          message: `Lưu tại: ${res.folder_path} (duy trì ${res.total_backups_kept} bản sao lưu gần nhất)`,
        });
        await refreshStatus();
      } else {
        notify.error({
          title: 'Sao lưu không hoàn tất',
          message:
            res.error || 'Có lỗi xảy ra trong quá trình ghi tệp sao lưu.',
        });
      }
    } catch (error) {
      console.error(error);
      notify.error({
        title: 'Sao lưu thất bại',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBackingUp(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await openBackupFolder();
    } catch (err) {
      notify.error({
        title: 'Không thể mở thư mục',
        message: String(err),
      });
    }
  };

  return (
    <div
      style={{
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--affine-border-color, #333)',
      }}
    >
      <SettingRow
        name="Sao lưu Markdown tự động cục bộ"
        desc="Xuất toàn bộ tài liệu thành các tệp Markdown (.md) theo ngày, tự động xoay vòng duy trì 14 bản gần nhất để bảo vệ dữ liệu chống mất mát."
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            onClick={() => {
              handleOpenFolder().catch(console.error);
            }}
          >
            Mở thư mục
          </Button>
          <Button
            onClick={() => {
              handleBackupNow().catch(console.error);
            }}
            disabled={backingUp}
            variant="primary"
          >
            {backingUp ? 'Đang sao lưu...' : 'Sao lưu ngay'}
          </Button>
        </div>
      </SettingRow>
      <div
        style={{
          fontSize: '12px',
          color: 'var(--affine-text-secondary-color, #888)',
          marginTop: '8px',
          paddingLeft: '4px',
        }}
      >
        {status ? (
          <span>
            Đang lưu {status.total_backups} bản sao lưu · Lần cuối:{' '}
            {status.last_backup_date || 'Chưa sao lưu'} · Thư mục:{' '}
            {status.backup_dir}
          </span>
        ) : (
          <span>
            Chức năng tự động lưu trữ Markdown an toàn cho bản AFFiNE Cá nhân
            Desktop.
          </span>
        )}
      </div>
    </div>
  );
};

const Empty = () => {
  const t = useI18n();
  return (
    <div className={styles.empty}>
      {t['com.affine.settings.workspace.backup.empty']()}
    </div>
  );
};

const BlobAvatar = ({
  blob,
  name,
}: {
  blob: Uint8Array | null;
  name: string;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(new Blob([toArrayBuffer(blob)]));
    setUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);
  return (
    <Avatar colorfulFallback name={name} rounded={4} size={32} url={url} />
  );
};

type BackupWorkspaceItem = {
  id: string;
  name: string;
  fileSize: number;
  updatedAt: Date;
  avatar: Uint8Array | null;
  dbPath: string;
};

const BackupWorkspaceItem = ({ item }: { item: BackupWorkspaceItem }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const { openConfirmModal } = useConfirmModal();
  const backupService = useService(BackupService);
  const t = useI18n();
  const [importing, setImporting] = useState(false);

  const { jumpToPage } = useNavigateHelper();

  const handleImport = useAsyncCallback(async () => {
    setImporting(true);
    track.$.settingsPanel.archivedWorkspaces.recoverArchivedWorkspace();
    const workspaceId = await backupService.recoverBackupWorkspace(item.id);
    if (!workspaceId) {
      setImporting(false);
      return;
    }
    notify.success({
      title: t['com.affine.settings.workspace.backup.import.success'](),
      actions: [
        {
          key: 'open',
          label:
            t['com.affine.settings.workspace.backup.import.success.action'](),
          onClick: () => {
            jumpToPage(workspaceId, 'all');
          },
          autoClose: false,
        },
      ],
    });
    setMenuOpen(false);
    setImporting(false);
  }, [backupService, item.id, jumpToPage, t]);

  const handleDelete = useCallback(
    (backupWorkspaceId: string) => {
      openConfirmModal({
        title: t['com.affine.workspaceDelete.title'](),
        children: t['com.affine.settings.workspace.backup.delete.warning'](),
        onConfirm: async () => {
          track.$.settingsPanel.archivedWorkspaces.deleteArchivedWorkspace();
          await backupService.deleteBackupWorkspace(backupWorkspaceId);
          notify.success({
            title: t['com.affine.settings.workspace.backup.delete.success'](),
          });
        },
        confirmText: t['Confirm'](),
        cancelText: t['Cancel'](),
        confirmButtonOptions: {
          variant: 'error',
        },
      });
    },
    [backupService, openConfirmModal, t]
  );

  return (
    <div
      data-testid="backup-workspace-item"
      className={styles.listItem}
      key={item.id}
      onClick={() => setMenuOpen(v => !v)}
    >
      <BlobAvatar blob={item.avatar} name={item.name} />
      <div className={styles.listItemLeftLabel}>
        <div className={styles.listItemLeftLabelTitle}>{item.name}</div>
        <div className={styles.listItemLeftLabelDesc}>
          {bytes(item.fileSize)}
        </div>
      </div>
      <div className={styles.listItemRightLabel}>
        {t['com.affine.settings.workspace.backup.delete-at']({
          date: i18nTime(item.updatedAt, {
            absolute: {
              accuracy: 'day',
            },
          }),
          time: i18nTime(item.updatedAt, {
            absolute: {
              accuracy: 'minute',
              noDate: true,
              noYear: true,
            },
          }),
        })}
        <Menu
          rootOptions={{
            open: menuOpen && !importing,
            onOpenChange: setMenuOpen,
            modal: true,
          }}
          items={
            <>
              <MenuItem
                prefixIcon={<LocalWorkspaceIcon />}
                onClick={handleImport}
              >
                {t['com.affine.settings.workspace.backup.import']()}
              </MenuItem>
              <MenuItem
                prefixIcon={<DeleteIcon />}
                onClick={() => handleDelete(item.id)}
                type="danger"
              >
                {t['Delete']()}
              </MenuItem>
            </>
          }
          contentOptions={{ align: 'end' }}
        >
          <IconButton disabled={importing} size="20">
            {importing ? <Loading /> : <MoreVerticalIcon />}
          </IconButton>
        </Menu>
      </div>
    </div>
  );
};

const PAGE_SIZE = 6;

const ElectronArchivedWorkspacesList = () => {
  const backupService = useService(BackupService);

  useEffect(() => {
    backupService.revalidate();
  }, [backupService]);

  const isLoading = useLiveData(backupService.isLoading$);
  const backupWorkspaces = useLiveData(backupService.pageBackupWorkspaces$);

  const [pageNum, setPageNum] = useState(0);

  const innerElement = useMemo(() => {
    if (isLoading) {
      return (
        <Skeleton
          style={{ margin: '2px', width: 'calc(100% - 4px)' }}
          height={60}
          animation="wave"
        />
      );
    }
    if (!backupWorkspaces) {
      return null;
    }
    return (
      <>
        <div className={styles.list}>
          {backupWorkspaces.items
            .slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE)
            .map(item => (
              <BackupWorkspaceItem key={item.id} item={item} />
            ))}
        </div>
        {backupWorkspaces.items.length > PAGE_SIZE && (
          <div className={styles.pagination}>
            <Pagination
              totalCount={backupWorkspaces?.items.length ?? 0}
              countPerPage={PAGE_SIZE}
              pageNum={pageNum}
              onPageChange={(_, pageNum) => {
                setPageNum(pageNum);
              }}
            />
          </div>
        )}
      </>
    );
  }, [isLoading, backupWorkspaces, pageNum]);

  const isEmpty =
    (backupWorkspaces?.items.length === 0 || !backupWorkspaces) && !isLoading;

  return isEmpty ? (
    <Empty />
  ) : (
    <div className={styles.listContainer}>{innerElement}</div>
  );
};

export const BackupSettingPanel = () => {
  const t = useI18n();

  return (
    <>
      <SettingHeader
        title={t['com.affine.settings.workspace.backup']()}
        subtitle={t['com.affine.settings.workspace.backup.subtitle']()}
        data-testid="backup-title"
      />
      <AutoBackupSection />
      {BUILD_CONFIG.isElectron && <ElectronArchivedWorkspacesList />}
    </>
  );
};
