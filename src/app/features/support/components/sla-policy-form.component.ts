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
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import {
  TICKET_PRIORITIES,
  type SlaMatrix,
  type SlaPlanOption,
  type SlaPolicy,
  type SlaPolicyBody,
} from '../data/support.models';
import { matrixOf, matrixProblemOf } from '../data/ticket-view';
import {
  SlaMatrixFieldsComponent,
  minutesOf,
  type MatrixCellChange,
  type MatrixDraft,
} from './sla-matrix-fields.component';

type Draft = MatrixDraft;

const NO_PLAN = '';

const draftOf = (matrix: SlaMatrix): Draft =>
  TICKET_PRIORITIES.reduce((draft, priority) => {
    draft[priority] = {
      firstResponseMinutes: String(matrix[priority].firstResponseMinutes),
      resolutionMinutes: String(matrix[priority].resolutionMinutes),
    };
    return draft;
  }, {} as Draft);

@Component({
  selector: 'dba-sla-policy-form',
  imports: [
    TranslatePipe,
    FormsModule,
    Select,
    ToggleSwitch,
    ModalShellComponent,
    FieldComponent,
    SlaMatrixFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="clock"
      [title]="
        (policy() ? 'support.pol.form.editTitle' : 'support.pol.form.createTitle') | translate
      "
      [subtitle]="policy()?.name ?? ''"
      [confirmLabel]="policy() ? 'support.pol.form.save' : 'support.pol.form.create'"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="620"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-field
          label="support.pol.form.name"
          placeholder="support.pol.form.namePlaceholder"
          [maxlength]="80"
          [error]="nameError()"
          [(value)]="name"
        />

        <div class="form__control">
          <label class="form__label" for="sla-plan">{{
            'support.pol.form.plan' | translate
          }}</label>
          <p-select
            inputId="sla-plan"
            [options]="planChoices()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="planId()"
            (ngModelChange)="planId.set($event)"
            [disabled]="!canPickPlan()"
            [filter]="planChoices().length > 8"
            appendTo="body"
            styleClass="form__select"
          />
          <span class="dba-meta">{{
            (canPickPlan() ? 'support.pol.form.planHint' : 'support.pol.form.planLocked')
              | translate
          }}</span>
        </div>

        <div class="form__switch">
          <p-toggleswitch
            inputId="sla-default"
            [ngModel]="isDefault()"
            (ngModelChange)="isDefault.set($event)"
            [disabled]="lockedDefault()"
          />
          <span class="form__switchCopy">
            <label class="form__label" for="sla-default">{{
              'support.pol.form.isDefault' | translate
            }}</label>
            <span class="dba-meta">{{
              (lockedDefault() ? 'support.pol.form.defaultLocked' : 'support.pol.form.defaultHint')
                | translate
            }}</span>
          </span>
        </div>

        <div class="form__switch">
          <p-toggleswitch
            inputId="sla-active"
            [ngModel]="active()"
            (ngModelChange)="active.set($event)"
            [disabled]="lockedDefault()"
          />
          <span class="form__switchCopy">
            <label class="form__label" for="sla-active">{{
              'support.pol.form.active' | translate
            }}</label>
            <span class="dba-meta">{{ 'support.pol.form.activeHint' | translate }}</span>
          </span>
        </div>

        <h3 class="dba-panel form__section">{{ 'support.pol.form.matrix' | translate }}</h3>
        <p class="dba-meta form__note--top">{{ 'support.pol.form.matrixHint' | translate }}</p>
        <dba-sla-matrix-fields [draft]="draft()" (changed)="setCell($event)" />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class SlaPolicyFormComponent implements OnInit {
  private readonly translate = inject(TranslateService);

  readonly policy = input<SlaPolicy | null>(null);
  readonly plans = input<readonly SlaPlanOption[]>([]);
  readonly canPickPlan = input(false);
  readonly busy = input(false);
  readonly submitted = output<SlaPolicyBody>();
  readonly dismissed = output<void>();

  protected readonly name = signal('');
  protected readonly planId = signal<string>(NO_PLAN);
  protected readonly isDefault = signal(false);
  protected readonly active = signal(true);
  protected readonly draft = signal<Draft>(draftOf(matrixOf(null)));

  protected readonly lockedDefault = computed(() => !!this.policy()?.isDefault);

  protected readonly planChoices = computed(() => {
    const choices = [
      { id: NO_PLAN, label: this.label('support.pol.form.noPlan') },
      ...this.plans().map((plan) => ({ id: plan.id, label: plan.name })),
    ];
    const current = this.planId();
    if (current && !choices.some((choice) => choice.id === current))
      choices.push({ id: current, label: current });
    return choices;
  });

  protected readonly matrix = computed<SlaMatrix>(() => {
    const draft = this.draft();
    return TICKET_PRIORITIES.reduce((matrix, priority) => {
      matrix[priority] = {
        firstResponseMinutes: minutesOf(draft[priority].firstResponseMinutes),
        resolutionMinutes: minutesOf(draft[priority].resolutionMinutes),
      };
      return matrix;
    }, {} as SlaMatrix);
  });

  protected readonly problem = computed(() => matrixProblemOf(this.matrix()));

  protected readonly nameError = computed(() => {
    const name = this.name().trim();
    return name.length > 0 && name.length < 2 ? 'support.pol.form.nameShort' : '';
  });

  protected readonly valid = computed(
    () => this.name().trim().length >= 2 && this.problem() === null && !this.busy(),
  );

  ngOnInit(): void {
    const policy = this.policy();
    this.draft.set(draftOf(matrixOf(policy)));
    if (!policy) return;
    this.name.set(policy.name);
    this.planId.set(policy.planId ?? NO_PLAN);
    this.isDefault.set(policy.isDefault);
    this.active.set(policy.active);
  }

  protected setCell(change: MatrixCellChange): void {
    this.draft.update((draft) => ({
      ...draft,
      [change.priority]: { ...draft[change.priority], [change.key]: change.value },
    }));
  }

  protected submit(): void {
    if (!this.valid()) return;
    const planId = this.planId();
    const policy = this.policy();
    this.submitted.emit({
      name: this.name().trim(),
      planId: planId ? planId : policy?.planId ? null : undefined,
      isDefault: this.isDefault(),
      active: this.lockedDefault() ? true : this.active(),
      matrix: this.matrix(),
    });
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
