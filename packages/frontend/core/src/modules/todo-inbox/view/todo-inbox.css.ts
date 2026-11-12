import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  width: '100%',
  height: '100%',
  overflowY: 'auto',
  padding: '16px 24px 48px',
  boxSizing: 'border-box',
});

export const inner = style({
  maxWidth: 760,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
});

export const hint = style({
  fontSize: 13,
  color: cssVarV2('text/secondary'),
});

export const empty = style({
  padding: '48px 0',
  textAlign: 'center',
  color: cssVarV2('text/secondary'),
});

export const group = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const groupTitle = style({
  fontSize: 13,
  fontWeight: 600,
  padding: '4px 8px',
  color: cssVarV2('text/secondary'),
});

export const overdueTitle = style([
  groupTitle,
  { color: cssVarV2('text/emphasis') },
]);

export const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 8px',
  borderRadius: 6,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});

export const rowMain = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
});

export const rowTitle = style({
  fontSize: 14,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const rowDoc = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const rowMeta = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  whiteSpace: 'nowrap',
});

export const doneToggle = style({
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const quickAdd = style({
  display: 'flex',
  gap: 8,
});

export const quickAddInput = style({
  flex: 1,
  minWidth: 0,
  padding: '8px 12px',
  fontSize: 14,
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  outline: 'none',
  selectors: {
    '&:focus': {
      borderColor: cssVarV2('button/primary'),
    },
  },
});

export const quickAddButton = style({
  padding: '0 16px',
  fontSize: 14,
  color: cssVarV2('button/pureWhiteText'),
  background: cssVarV2('button/primary'),
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  selectors: {
    '&:disabled': {
      opacity: 0.5,
      cursor: 'default',
    },
  },
});

export const reminder = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const reminderText = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  fontSize: 14,
});

export const dateInput = style({
  padding: '2px 6px',
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  background: 'transparent',
  border: `1px solid transparent`,
  borderRadius: 6,
  cursor: 'pointer',
  selectors: {
    '&:hover, &:focus': {
      borderColor: cssVarV2('layer/insideBorder/border'),
    },
  },
});
