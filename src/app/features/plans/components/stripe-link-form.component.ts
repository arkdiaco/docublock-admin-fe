import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { PlanDetail, StripeLinkBody } from '../data/plans.models';

const PRICE_ID = /^price_[A-Za-z0-9]+$/;

@Component({
  selector: 'dba-stripe-link-form',
  imports: [TranslatePipe, ModalShellComponent, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="chain"
      [title]="'plans.stripeLink.title' | translate"
      [subtitle]="plan().name + ' · ' + plan().code + ' · v' + plan().version"
      confirmLabel="plans.stripeLink.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="dba-meta form__note--top">
          {{
            'plans.stripeLink.lead'
              | translate: { monthly: monthlyAmount(), annual: annualAmount() }
          }}
        </p>
        <dba-field
          label="plans.stripeLink.monthly"
          mono
          placeholder="plans.stripeLink.placeholder"
          [maxlength]="80"
          [error]="idError(monthly())"
          [(value)]="monthly"
        />
        <dba-field
          label="plans.stripeLink.annual"
          mono
          placeholder="plans.stripeLink.placeholder"
          [maxlength]="80"
          [error]="idError(annual())"
          [(value)]="annual"
        />
        @if (pairError()) {
          <p class="dba-meta form__note--top">{{ 'plans.stripeLink.pair' | translate }}</p>
        }
        <p class="dba-meta">{{ 'plans.stripeLink.hint' | translate }}</p>
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
export class StripeLinkFormComponent implements OnInit {
  readonly plan = input.required<PlanDetail>();
  readonly monthlyAmount = input('');
  readonly annualAmount = input('');
  readonly busy = input(false);
  readonly submitted = output<StripeLinkBody>();
  readonly dismissed = output<void>();

  protected readonly monthly = signal('');
  protected readonly annual = signal('');
  protected readonly reason = signal('');

  protected readonly pairError = computed(() => !this.monthly().trim() !== !this.annual().trim());

  protected readonly valid = computed(() => {
    const monthly = this.monthly().trim();
    const annual = this.annual().trim();
    const current = this.current();
    const changed = (monthly || null) !== current.monthly || (annual || null) !== current.annual;
    return (
      !this.pairError() &&
      !this.idError(monthly) &&
      !this.idError(annual) &&
      changed &&
      !!this.reason().trim()
    );
  });

  private readonly current = computed(() => {
    const version = this.plan().history.find((v) => v.version === this.plan().version);
    return { monthly: version?.stripe.monthly ?? null, annual: version?.stripe.annual ?? null };
  });

  ngOnInit(): void {
    this.monthly.set(this.current().monthly ?? '');
    this.annual.set(this.current().annual ?? '');
  }

  protected idError(value: string): string {
    const trimmed = value.trim();
    return trimmed && !PRICE_ID.test(trimmed) ? 'plans.stripeLink.invalid' : '';
  }

  protected submit(): void {
    if (!this.valid()) return;
    this.submitted.emit({
      monthly: this.monthly().trim() || null,
      annual: this.annual().trim() || null,
      reason: this.reason().trim(),
    });
  }
}
