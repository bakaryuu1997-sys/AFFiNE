import { TodoInboxView } from '@affine/core/modules/todo-inbox';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';

export const Component = () => {
  const t = useI18n();

  return (
    <>
      <ViewTitle title={t['com.affine.todoInbox.title']()} />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <strong>{t['com.affine.todoInbox.title']()}</strong>
      </ViewHeader>
      <ViewBody>
        <TodoInboxView />
      </ViewBody>
    </>
  );
};
