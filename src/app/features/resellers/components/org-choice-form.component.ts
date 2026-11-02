import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { OrganizationOption } from '../../../shared/http/organization-lookup';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';

export type OrgChoiceMode = 'mark' | 'assign';

export const choiceProblemOf = (
  mode: OrgChoiceMode,
  option: OrganizationOption | null,
  resellerId: string,
): string => {
  if (!option) return '';
  if (mode === 'mark') return option.isReseller ? 'rsl.form.alreadyReseller' : '';
  if (option.id === resellerId) return 'rsl.form.self';
  return option.resellerId === resellerId ? 'rsl.form.alreadyHere' : '';
};

@Component({
  selector: 'dba-org-choice-form',
  imports: [TranslatePipe, ModalShellComponent, OrgPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="chain"
      [title]="'rsl.form.' + mode() + '.title' | translate"
      [subtitle]="subtitle()"
      [confirmLabel]="'rsl.form.' + mode() + '.confirm'"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__control">
          <span class="form__label">{{ 'rsl.form.org' | translate }}</span>
          <dba-org-picker
            scope="commercial"
            anyKey="orgPicker.choose"
            [value]="option()?.id ?? null"
            (selection)="option.set($event)"
          />
        </div>
        @if (problem()) {
          <p class="dba-meta">{{ problem() | translate }}</p>
        } @else if (mode() === 'assign' && option()?.resellerName) {
          <p class="dba-meta">
            {{ 'rsl.form.moves' | translate: { from: option()!.resellerName, to: subtitle() } }}
          </p>
        } @else {
          <p class="dba-meta">{{ 'rsl.form.' + mode() + '.note' | translate }}</p>
        }
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class OrgChoiceFormComponent {
  readonly mode = input.required<OrgChoiceMode>();
  readonly resellerId = input('');
  readonly subtitle = input('');
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly option = signal<OrganizationOption | null>(null);
  protected readonly problem = computed(() =>
    choiceProblemOf(this.mode(), this.option(), this.resellerId()),
  );
  protected readonly valid = computed(() => !!this.option() && !this.problem());

  protected submit(): void {
    const option = this.option();
    if (option && this.valid()) this.submitted.emit(option.id);
  }
}
