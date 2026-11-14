import type { WeekDatePickerHandle } from '@affine/component';
import { WeekDatePicker } from '@affine/component';
import {
  JOURNAL_DATE_FORMAT,
  JournalService,
} from '@affine/core/modules/journal';
import { WorkbenchService } from '@affine/core/modules/workbench';
import type { Store } from '@blocksuite/affine/store';
import { useLiveData, useService } from '@toeverything/infra';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface JournalWeekDatePickerProps {
  page: Store;
}

export const JournalWeekDatePicker = ({ page }: JournalWeekDatePickerProps) => {
  const handleRef = useRef<WeekDatePickerHandle>(null);
  const journalService = useService(JournalService);
  const journalDateStr = useLiveData(journalService.journalDate$(page.id));
  const journalDate = journalDateStr ? dayjs(journalDateStr) : null;
  const [date, setDate] = useState(
    (journalDate ?? dayjs()).format(JOURNAL_DATE_FORMAT)
  );
  const workbench = useService(WorkbenchService).workbench;

  useEffect(() => {
    if (!journalDate) return;
    setDate(journalDate.format(JOURNAL_DATE_FORMAT));
    handleRef.current?.setCursor?.(journalDate);
  }, [journalDate]);

  const openJournal = useCallback(
    (pickedDate: string) => {
      const docs = journalService.journalsByDate$(pickedDate).value;
      if (docs.length > 0) {
        workbench.openDoc(docs[0].id, { at: 'active' });
      } else {
        workbench.open(`/journals?date=${pickedDate}`, { at: 'active' });
      }
    },
    [journalService, workbench]
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 900,
        width: '100%',
        justifyContent: 'center',
      }}
    >
      <WeekDatePicker
        data-testid="journal-week-picker"
        handleRef={handleRef}
        style={{ flex: 1, maxWidth: 680 }}
        value={date}
        onChange={openJournal}
      />
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: 'var(--affine-background-secondary-color, #2b2b30)',
            border: '1px solid var(--affine-border-color, #444)',
            color: 'var(--affine-text-primary-color, #eee)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Bấm để chọn Ngày / Tháng / Năm"
        >
          <span>📅 {dayjs(date).format('DD/MM/YYYY')}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
        </button>
        <input
          type="date"
          value={date}
          onChange={e => {
            if (e.target.value) {
              openJournal(e.target.value);
            }
          }}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer',
            width: '100%',
            height: '100%',
          }}
          title="Bấm để chọn Ngày / Tháng / Năm"
        />
      </div>
    </div>
  );
};
