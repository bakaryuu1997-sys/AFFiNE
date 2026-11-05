import { MenuLinkItem } from '@affine/core/modules/app-sidebar/views';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';
import { DoneIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';

export const AppSidebarTodoButton = () => {
  const t = useI18n();
  const workbench = useService(WorkbenchService).workbench;
  const active = useLiveData(
    workbench.location$.selector(location => location.pathname === '/todo')
  );

  return (
    <MenuLinkItem
      data-testid="slider-bar-todo-button"
      active={active}
      to={'/todo'}
      icon={<DoneIcon />}
    >
      {t['com.affine.todoInbox.title']()}
    </MenuLinkItem>
  );
};
