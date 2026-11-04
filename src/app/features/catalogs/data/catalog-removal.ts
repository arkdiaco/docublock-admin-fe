import { DialogService } from '../../../core/ui/dialog.service';

export const CATALOG_REASON = {
  labelKey: 'sub.reasonLabel',
  placeholder: 'sub.reasonPlaceholder',
  limit: 500,
  quick: [],
  required: true,
};

export const askRemovalReason = async (
  dialogs: DialogService,
  name: string,
  kindKey: string,
): Promise<string | null> => {
  const answer = await dialogs.open({
    intent: 'danger',
    icon: 'trash',
    title: 'cat.remove.title',
    message: kindKey,
    params: { name },
    confirmLabel: 'cat.action.remove',
    reason: CATALOG_REASON,
  });
  return answer.answer === 'confirm' && answer.reason ? answer.reason : null;
};
