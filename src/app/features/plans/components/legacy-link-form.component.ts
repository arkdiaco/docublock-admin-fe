import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { PlansApi } from '../data/plans.api';
import type { LegacyPlanChoice, PlanDetail } from '../data/plans.models';

const NONE = '';

@Component({
  selector: 'dba-legacy-link-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="chain"
      [title]="'plans.legacyLink.title' | translate"
      [subtitle]="plan().name + ' · ' + plan().code"
      confirmLabel="plans.legacyLink.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="dba-meta form__note--top">{{ 'plans.legacyLink.lead' | translate }}</p>
        <div class="form__control">
          <label class="form__label" for="plan-legacy">{{
            'plans.legacyLink.field' | translate
          }}</label>
          <p-select
            inputId="plan-legacy"
            [options]="options()"
            optionLabel="label"
            optionValue="id"
            [filter]="true"
            [loading]="loading()"
            [ngModel]="legacyId()"
            (ngModelChange)="legacyId.set($event)"
            appendTo="body"
            styleClass="form__select"
          />
          @if (sharedWith().length > 0) {
            <span class="dba-meta">{{
              'plans.legacyLink.shared' | translate: { codes: sharedWith().join(', ') }
            }}</span>
          }
        </div>
        @if (plan().subscribers > 0) {
          <div class="form__summary">
            <span>{{ 'plans.legacyLink.mirror' | translate: { total: plan().subscribers } }}</span>
          </div>
        }
        <dba-field
          label="plans.f.reason"
          placeholder="plans.form.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class LegacyLinkFormComponent implements OnInit {
  private readonly api = inject(PlansApi);
  private readonly translate = inject(TranslateService);

  readonly plan = input.required<PlanDetail>();
  readonly busy = input(false);
  readonly submitted = output<{ legacyPlanId: string | null; reason: string }>();
  readonly dismissed = output<void>();

  protected readonly legacyId = signal(NONE);
  protected readonly reason = signal('');
  protected readonly loading = signal(true);
  private readonly choices = signal<LegacyPlanChoice[]>([]);

  protected readonly options = computed(() => [
    { id: NONE, label: this.translate.instant('plans.legacyLink.none') as string },
    ...this.choices().map((choice) => ({ id: choice.id, label: choice.name || choice.id })),
  ]);

  protected readonly sharedWith = computed(
    () =>
      this.choices()
        .find((choice) => choice.id === this.legacyId())
        ?.plansLinked.filter((code) => code !== this.plan().code) ?? [],
  );

  protected readonly valid = computed(
    () => this.legacyId() !== (this.plan().legacyPlan?.id ?? NONE) && !!this.reason().trim(),
  );

  ngOnInit(): void {
    const current = this.plan().legacyPlan;
    if (current) {
      this.legacyId.set(current.id);
      this.choices.set([
        { ...current, costMonthly: null, documentsMonthly: null, plansLinked: [this.plan().code] },
      ]);
    }
    void this.load();
  }

  protected submit(): void {
    if (!this.valid()) return;
    this.submitted.emit({ legacyPlanId: this.legacyId() || null, reason: this.reason().trim() });
  }

  private async load(): Promise<void> {
    try {
      this.choices.set(await firstValueFrom(this.api.legacyPlans()));
    } catch {
      return;
    } finally {
      this.loading.set(false);
    }
  }
}
