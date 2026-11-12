import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const badge = style({
  minWidth: 18,
  height: 18,
  padding: '0 5px',
  boxSizing: 'border-box',
  borderRadius: 9,
  fontSize: 11,
  lineHeight: '18px',
  textAlign: 'center',
  color: cssVarV2('button/pureWhiteText'),
  background: cssVarV2('button/primary'),
});

export const badgeOverdue = style([
  badge,
  {
    background: cssVarV2('status/error'),
  },
]);
