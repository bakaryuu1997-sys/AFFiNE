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
