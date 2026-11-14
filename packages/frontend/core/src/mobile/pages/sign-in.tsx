import { useEffect } from 'react';
// oxlint-disable-next-line no-restricted-imports
import { useNavigate } from 'react-router-dom';

export const Component = () => {
  const navigate = useNavigate();

  useEffect(() => {
    Promise.resolve(navigate('/', { replace: true })).catch(console.error);
  }, [navigate]);

  return null;
};
