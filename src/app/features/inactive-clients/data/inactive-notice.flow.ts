import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { errorCodeOf } from '../../../shared/http/error-code';
import { safeDate, type DateInput } from '../../../shared/i18n/safe-date';
import { InactiveClientsApi } from './inactive-clients.api';
import type { InactiveOrganizationRow } from './inactive-clients.models';
import { rowExportStageOf } from './inactive-export-stage';

export const NOTICE_GRACE_DAYS = 30;

const DAY_MS = 86_400_000;

const KNOWN_ERRORS: readonly string[] = [
  'CONFIRMACION_INVALIDA',
  'ORGANIZACION_SIN_CORREO',
  'ORGANIZACION_NO_ENCONTRADA',
];

@Injectable({ providedIn: 'root' })
export class InactiveNoticeFlow {
  private readonly api = inject(InactiveClientsApi);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);

  async send(row: InactiveOrganizationRow): Promise<boolean> {
    const { organization } = row;
    const answer = await this.dialogs.open({
      intent: 'warn',
      icon: 'mail',
      size: 'wide',
      title: 'inactive.notice.title',
      message: 'inactive.notice.message',
      params: {
        name: organization.businessName,
        email: organization.email ?? '',
        date: this.day(Date.now() + NOTICE_GRACE_DAYS * DAY_MS),
      },
      confirmLabel: 'inactive.notice.confirm',
      reason: {
        labelKey: 'sub.reasonLabel',
        placeholder: 'inactive.notice.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
      warnings: this.warnings(row),
      challenge: { identifier: organization.tributaryNumber, actionKey: 'inactive.notice.verb' },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return false;
    try {
      const sent = await firstValueFrom(
        this.api.sendNotice(organization.id, {
          reason: answer.reason,
          tributaryNumber: organization.tributaryNumber,
        }),
      );
      this.notify.success(this.label('inactive.notice.sent', { email: sent.email }));
      return true;
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code !== null && KNOWN_ERRORS.includes(code);
      this.notify.error(this.label(`inactive.notice.error.${known ? code : 'generic'}`));
      return false;
    }
  }

  private warnings(row: InactiveOrganizationRow): string[] {
    const lines: string[] = [];
    if (row.lastNotice) {
      lines.push(
        this.label('inactive.notice.alreadySent', {
          date: this.day(row.lastNotice.sentAt),
          n: row.lastNotice.count + 1,
        }),
      );
    }
    lines.push(
      rowExportStageOf(row.lastExport) === 'ready'
        ? this.label('inactive.notice.withLink', { date: this.day(row.lastExport?.expiresAt) })
        : this.label('inactive.notice.withoutLink'),
    );
    return lines;
  }

  private day(value: DateInput): string {
    return safeDate(value, 'd/MM/y', this.locale);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
