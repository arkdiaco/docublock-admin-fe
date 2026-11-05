import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import {
  draftOf,
  isRecommended,
  isTextKind,
  parseSettingDraft,
  sameSettingValue,
  valueLabelOf,
} from '../data/settings-view';
import type { SettingItem, SettingKind, SettingValue } from '../data/settings.models';

const OUT_OF_RECOMMENDED: Record<SettingKind, string> = {
  integer: 'cfg.edit.outOfRecommended',
  integer_list: 'cfg.edit.outOfRecommended',
  text: 'cfg.edit.outOfRecommendedText',
  text_list: 'cfg.edit.outOfRecommendedLines',
};

export interface SettingEditResult {
  value: SettingValue;
  reason: string;
}

@Component({
  selector: 'dba-setting-edit',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent, TextAreaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="settings"
      [title]="'cfg.item.' + setting().key + '.label' | translate"
      [subtitle]="'cfg.item.' + setting().key + '.audience' | translate"
      confirmLabel="cfg.edit.confirm"
      [confirmDisabled]="!canSubmit()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (setting().kind === 'text_list') {
          <dba-text-area
            [label]="fieldLabel()"
            [rows]="setting().maxItems ?? 3"
            [hint]="hint()"
            [error]="invalid() ? errorText() : ''"
            [(value)]="draft"
          />
        } @else {
          <dba-field
            [label]="fieldLabel()"
            [mono]="!textual()"
            [inputmode]="textual() ? null : 'numeric'"
            [maxlength]="textual() ? setting().technical.max : null"
            [hint]="hint()"
            [error]="invalid() ? errorText() : ''"
            [(value)]="draft"
          />
        }
        @if (setting().group === 'validation') {
          <p class="notice" role="note">{{ 'cfg.edit.identityRisk' | translate }}</p>
        }
        @if (outOfRecommended()) {
          <p class="notice" role="note">
            {{ outOfRecommendedKey() | translate: setting().recommended }}
          </p>
        }
        <dba-field
          label="cfg.reasonLabel"
          placeholder="cfg.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
        <p class="sum">{{ 'cfg.edit.delay' | translate }}</p>
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class SettingEditComponent {
  readonly setting = input.required<SettingItem>();
  readonly busy = input(false);
  readonly submitted = output<SettingEditResult>();
  readonly dismissed = output<void>();

  private readonly translate = inject(TranslateService);

  protected readonly draft = linkedSignal(() => draftOf(this.setting()));
  protected readonly reason = signal('');

  private readonly parsed = computed(() => parseSettingDraft(this.setting(), this.draft()));

  protected readonly textual = computed(() => isTextKind(this.setting().kind));
  protected readonly invalid = computed(() => this.parsed() === null);
  protected readonly outOfRecommended = computed(() => {
    const value = this.parsed();
    return value !== null && !isRecommended(this.setting(), value);
  });
  protected readonly outOfRecommendedKey = computed(() => OUT_OF_RECOMMENDED[this.setting().kind]);
  protected readonly fieldLabel = computed(() => `cfg.editLabel.${this.setting().unit}`);
  protected readonly hint = computed(() => {
    const { unit, defaultValue, kind, maxItems } = this.setting();
    if (kind === 'text_list') {
      return this.translate.instant('cfg.edit.linesHint', { maxItems }) as string;
    }
    const { key, params } = valueLabelOf(unit, defaultValue);
    const label = this.translate.instant(key, params) as string;
    if (kind === 'text') {
      return this.translate.instant('cfg.edit.defaultTextHint', { value: label }) as string;
    }
    const list =
      kind === 'integer_list' ? (this.translate.instant('cfg.edit.listHint') as string) : '';
    return `${this.translate.instant('cfg.edit.defaultHint', { value: label }) as string}${list}`;
  });
  protected readonly errorText = computed(() => {
    const { technical, maxItems } = this.setting();
    return this.translate.instant(this.errorKey(), { ...technical, maxItems }) as string;
  });
  protected readonly canSubmit = computed(() => {
    const value = this.parsed();
    return (
      value !== null && !sameSettingValue(value, this.setting().value) && !!this.reason().trim()
    );
  });

  protected submit(): void {
    const value = this.parsed();
    if (value === null || !this.canSubmit() || this.busy()) return;
    this.submitted.emit({ value, reason: this.reason().trim() });
  }

  private errorKey(): string {
    const { kind, charset } = this.setting();
    if (kind === 'integer_list') return 'cfg.edit.invalidList';
    if (kind === 'text_list') return 'cfg.edit.invalidLines';
    if (kind === 'text')
      return charset === 'name' ? 'cfg.edit.invalidName' : 'cfg.edit.invalidText';
    return 'cfg.edit.invalid';
  }
}
