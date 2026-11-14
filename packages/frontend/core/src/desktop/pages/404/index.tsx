import { NotFoundPage } from '@affine/component/not-found-page';
import { DesktopApiService } from '@affine/core/modules/desktop-api';
import { useServiceOptional } from '@toeverything/infra';
import type { ReactElement } from 'react';
import { useCallback, useEffect } from 'react';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';

const noop = () => {};

/**
 * Personal build: there are no accounts, so "no permission" and "not found"
 * look the same. The page only offers a back button. It must never navigate on
 * its own: a redirect here would hide the real reason a document did not open
 * (it used to bounce every doc back to "All docs" through the sign-in page).
 */
export const PageNotFound = (_props?: {
  /** kept for the callers that still pass it; has no effect */
  noPermission?: boolean;
}): ReactElement => {
  const desktopApi = useServiceOptional(DesktopApiService);
  const { jumpToIndex } = useNavigateHelper();

  const handleBackButtonClick = useCallback(
    () => jumpToIndex(RouteLogic.REPLACE),
    [jumpToIndex]
  );

  useEffect(() => {
    desktopApi?.handler.ui.pingAppLayoutReady().catch(console.error);
  }, [desktopApi]);

  return <NotFoundPage onBack={handleBackButtonClick} onSignOut={noop} />;
};

export const Component = () => {
  return <PageNotFound />;
};
