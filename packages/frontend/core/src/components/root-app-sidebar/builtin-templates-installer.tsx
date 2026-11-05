import { BuiltinTemplatesService } from '@affine/core/modules/template-doc';
import { useService } from '@toeverything/infra';
import { useEffect } from 'react';

/** Installs the bundled Vietnamese templates once per workspace. */
export const BuiltinTemplatesInstaller = () => {
  const builtinTemplates = useService(BuiltinTemplatesService);

  useEffect(() => {
    builtinTemplates.ensureInstalled().catch(console.error);
  }, [builtinTemplates]);

  return null;
};
