import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

const control = {
  height: 30,
  padding: '0 8px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/primary'),
  fontSize: 13,
  outline: 'none',
  selectors: {
    '&:focus': { borderColor: cssVarV2('button/primary') },
  },
} as const;

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  minHeight: 0,
});

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  flexWrap: 'wrap',
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const select = style({ ...control, maxWidth: 240, minWidth: 120 });
export const input = style({ ...control, width: '100%' });
export const spacer = style({ flex: 1 });

export const messages = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '16px 0',
});

export const column = style({
  maxWidth: 780,
  margin: '0 auto',
  padding: '0 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
});

export const bubbleUser = style({
  alignSelf: 'flex-end',
  maxWidth: '85%',
  padding: '8px 12px',
  borderRadius: 12,
  background: cssVarV2('layer/background/hoverOverlay'),
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 14,
  lineHeight: '22px',
});

export const bubbleAssistant = style({
  alignSelf: 'stretch',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 14,
  lineHeight: '22px',
  color: cssVarV2('text/primary'),
});

export const bubbleError = style({
  color: cssVarV2('button/error'),
  fontSize: 13,
});

export const actionsRow = style({
  display: 'flex',
  gap: 8,
  marginTop: 4,
});

export const empty = style({
  margin: 'auto',
  textAlign: 'center',
  maxWidth: 420,
  padding: 24,
  color: cssVarV2('text/secondary'),
});

export const emptyTitle = style({
  fontSize: 18,
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  marginBottom: 8,
});

export const composer = style({
  borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  padding: '10px 0 14px',
});

export const chips = style({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginBottom: 8,
});

export const chip = style({
  cursor: 'pointer',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: 'transparent',
  color: cssVarV2('text/secondary'),
  borderRadius: 14,
  padding: '2px 10px',
  fontSize: 12,
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
  },
});

export const textareaRow = style({
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
});

export const textarea = style({
  flex: 1,
  minHeight: 44,
  maxHeight: 200,
  resize: 'vertical',
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/primary'),
  fontSize: 14,
  lineHeight: '22px',
  fontFamily: 'inherit',
  outline: 'none',
  selectors: {
    '&:focus': { borderColor: cssVarV2('button/primary') },
  },
});

export const hint = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const settingsBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '4px 4px 8px',
  maxHeight: '65vh',
  overflowY: 'auto',
});

export const providerCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: cssVarV2('text/secondary'),
});

export const checkRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: cssVarV2('text/primary'),
});

export const statusOk = style({
  fontSize: 12,
  color: cssVarV2('button/success'),
});
export const statusErr = style({
  fontSize: 12,
  color: cssVarV2('button/error'),
});

export const historyDrawer = style({
  position: 'absolute',
  top: 48,
  left: 16,
  zIndex: 100,
  width: 320,
  maxHeight: 'calc(100% - 64px)',
  background: cssVarV2('layer/background/primary'),
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

export const historyHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  fontWeight: 600,
  fontSize: 13,
});

export const historyList = style({
  flex: 1,
  overflowY: 'auto',
  padding: '6px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const historyItem = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  color: cssVarV2('text/primary'),
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&[data-active="true"]': {
      background: cssVarV2('layer/background/hoverOverlay'),
      fontWeight: 500,
      borderLeft: `3px solid ${cssVarV2('button/primary')}`,
    },
  },
});

export const historyItemTitle = style({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginRight: 6,
});

export const historyItemTime = style({
  fontSize: 11,
  color: cssVarV2('text/secondary'),
  marginRight: 6,
  flexShrink: 0,
});

export const historyDeleteBtn = style({
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: 4,
  color: cssVarV2('text/secondary'),
  fontSize: 12,
  opacity: 0.6,
  selectors: {
    '&:hover': {
      opacity: 1,
      color: cssVarV2('button/error'),
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});
