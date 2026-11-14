import { useEffect } from 'react';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';

export const SignIn = (_props?: { redirectUrl?: string }) => {
  const { jumpToIndex } = useNavigateHelper();

  useEffect(() => {
    jumpToIndex(RouteLogic.REPLACE);
  }, [jumpToIndex]);

  return null;
};

export const Component = () => {
  return <SignIn />;
};
