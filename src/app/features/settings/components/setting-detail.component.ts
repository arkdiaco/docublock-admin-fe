import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { isTextKind, linesOf, rangeKeyOf, valueLabelOf } from '../data/settings-view';
import type { SettingItem, SettingValue } from '../data/settings.models';

@Component({
  selector: 'dba-setting-detail',
  imports: [TranslatePipe, ButtonComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="settings"
      [title]="'cfg.item.' + setting().key + '.label' | translate"
      [subtitle]="'cfg.item.' + setting().key + '.audience' | translate"
      [maxWidth]="560"
      [confirmLabel]="canManage() ? 'cfg.detail.change' : 'common.close'"
      [cancelable]="canManage()"
      cancelLabel="common.close"
      (confirmed)="canManage() ? changing.emit() : dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <p class="item__lead">{{ 'cfg.item.' + setting().key + '.hint' | translate }}</p>
      <dl class="item">
        <dt>{{ 'cfg.detail.value' | translate }}</dt>
        <dd [class.dba-mono]="!textual()" [class.item__lines]="lined()">
          {{ shown(setting().value) }}
        </dd>
        <dt>{{ 'cfg.detail.default' | translate }}</dt>
        <dd [class.dba-mono]="!textual()" [class.item__lines]="lined()">
          {{ shown(setting().defaultValue) }}
        </dd>
        <dt>{{ 'cfg.detail.recommended' | translate }}</dt>
        <dd>{{ rangeKey() | translate: rangeParams() }}</dd>
        @if (setting().lastChange; as last) {
          <dt>{{ 'cfg.detail.lastChange' | translate }}</dt>
          <dd>{{ when(last.at) }} · {{ last.adminName || ('cfg.unknownAdmin' | translate) }}</dd>
          <dt>{{ 'cfg.detail.reason' | translate }}</dt>
          <dd>{{ last.reason }}</dd>
        }
      </dl>
      @if (canManage() && !setting().isDefault) {
        <div class="item__actions">
          <button dba-button variant="secondary" (click)="resetting.emit()">
            {{ 'cfg.detail.reset' | translate }}
          </button>
        </div>
      }
    </db-modal-shell>
  `,
  styleUrl: './setting-item.scss',
})
export class SettingDetailComponent {
  readonly setting = input.required<SettingItem>();
  readonly changing = output<void>();
  readonly resetting = output<void>();
  readonly dismissed = output<void>();

  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  protected readonly canManage = computed(() => this.auth.canManage('platform'));
  protected readonly textual = computed(() => isTextKind(this.setting().kind));
  protected readonly lined = computed(() => this.setting().kind === 'text_list');
  protected readonly rangeKey = computed(() => rangeKeyOf(this.setting().kind));
  protected readonly rangeParams = computed(() => ({
    ...this.setting().recommended,
    maxItems: this.setting().maxItems,
  }));

  protected shown(value: SettingValue): string {
    if (this.lined()) return linesOf(value);
    const { key, params } = valueLabelOf(this.setting().unit, value);
    return this.translate.instant(key, params) as string;
  }

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm', this.locale);
  }
}
