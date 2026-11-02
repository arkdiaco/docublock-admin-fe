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
import { Select, type SelectFilterEvent } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { FieldComponent } from '../../../shared/ui/field.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import { PromotionsApi } from '../data/promotions.api';
import {
  CODE_PATTERN,
  EMAIL_PATTERN,
  MAX_QUANTITY,
  dayOf,
  endOfDayIso,
  isWhole,
} from '../data/promotions-view';
import type {
  CreateReferralBody,
  PromoCode,
  Referral,
  UpdateReferralBody,
} from '../data/promotions.models';

type CodeMode = 'new' | 'existing';

const MODES: readonly FilterPill[] = [
  { key: 'new', labelKey: 'ref.form.modeNew' },
  { key: 'existing', labelKey: 'ref.form.modeExisting' },
];

const OPTION_LIMIT = 20;

@Component({
  selector: 'dba-referral-form',
  imports: [
    TranslatePipe,
    FormsModule,
    Select,
    FieldComponent,
    FilterPillsComponent,
    ModalShellComponent,
    TextAreaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="user"
      [title]="(referral() ? 'ref.form.editTitle' : 'ref.form.createTitle') | translate"
      [subtitle]="referral()?.name ?? ''"
      [confirmLabel]="referral() ? 'ref.form.save' : 'ref.form.create'"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="600"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__pair">
          <dba-field label="ref.form.name" [maxlength]="120" [(value)]="name" />
          <dba-field
            label="ref.form.email"
            type="email"
            autocomplete="off"
            [maxlength]="160"
            [error]="emailProblem() ? 'ref.form.emailInvalid' : ''"
            [(value)]="email"
          />
        </div>
        <div class="form__pair">
          <dba-field label="ref.form.phone" [maxlength]="40" [(value)]="phone" />
          <dba-field label="ref.form.document" [maxlength]="40" [(value)]="document" />
        </div>
        <dba-text-area label="ref.form.notes" [maxlength]="500" [(value)]="notes" />

        @if (!referral()) {
          <h3 class="dba-panel form__section">{{ 'ref.form.codeSection' | translate }}</h3>
          <db-filter-pills
            [pills]="modes"
            [active]="mode()"
            [label]="'ref.form.codeSection' | translate"
            (activeChange)="pickMode($event)"
          />
          @if (mode() === 'new') {
            <dba-field
              label="ref.form.code"
              hint="promo.form.codeHint"
              mono
              autocomplete="off"
              [maxlength]="40"
              [error]="codeProblem() ? 'promo.form.codeInvalid' : ''"
              [(value)]="codeText"
            />
            <div class="form__pair">
              <dba-field
                label="promo.form.discount"
                inputmode="numeric"
                [error]="discountProblem() ? 'promo.form.discountInvalid' : ''"
                [(value)]="discount"
              />
              <dba-field
                label="promo.form.quantity"
                inputmode="numeric"
                [error]="quantityProblem() ? 'promo.form.quantityInvalid' : ''"
                [(value)]="quantity"
              />
            </div>
            <dba-field
              label="promo.form.expires"
              type="date"
              [error]="expiresProblem() ? 'promo.form.expiresInvalid' : ''"
              [(value)]="expires"
            />
          } @else {
            <div class="form__control">
              <label class="form__label" for="ref-code">{{
                'ref.form.existing' | translate
              }}</label>
              <p-select
                inputId="ref-code"
                [options]="codeOptions()"
                optionLabel="label"
                optionValue="id"
                [filter]="true"
                [resetFilterOnHide]="false"
                [placeholder]="'common.pick' | translate"
                [emptyFilterMessage]="'ref.form.existingEmpty' | translate"
                [ngModel]="existing()"
                (ngModelChange)="existing.set($event)"
                (onFilter)="searchCodes($event)"
                appendTo="body"
                styleClass="form__select"
              />
              <p class="dba-meta">{{ 'ref.form.existingHint' | translate }}</p>
            </div>
          }
        }
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class ReferralFormComponent implements OnInit {
  private readonly api = inject(PromotionsApi);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  readonly referral = input<Referral | null>(null);
  readonly busy = input(false);
  readonly created = output<CreateReferralBody>();
  readonly updated = output<UpdateReferralBody>();
  readonly dismissed = output<void>();

  protected readonly modes = MODES;
  protected readonly mode = signal<CodeMode>('new');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly document = signal('');
  protected readonly notes = signal('');
  protected readonly codeText = signal('');
  protected readonly discount = signal('');
  protected readonly quantity = signal('');
  protected readonly expires = signal('');
  protected readonly existing = signal<string | null>(null);
  private readonly found = signal<PromoCode[]>([]);

  protected readonly codeOptions = computed(() =>
    this.found().map((code) => ({
      id: code.id,
      label: this.translate.instant('ref.form.existingOption', {
        code: code.code,
        discount: code.discount,
      }) as string,
    })),
  );
  protected readonly emailProblem = computed(
    () => this.email().trim() !== '' && !EMAIL_PATTERN.test(this.email().trim()),
  );
  protected readonly codeProblem = computed(
    () => this.codeText().trim() !== '' && !CODE_PATTERN.test(this.codeText().trim()),
  );
  protected readonly discountProblem = computed(
    () => this.discount().trim() !== '' && !isWhole(this.discount(), 1, 100),
  );
  protected readonly quantityProblem = computed(
    () => this.quantity().trim() !== '' && !isWhole(this.quantity(), 1, MAX_QUANTITY),
  );
  protected readonly expiresProblem = computed(
    () => !!this.expires() && this.expires() < dayOf(new Date()),
  );
  private readonly codeValid = computed(() => {
    if (this.referral()) return true;
    if (this.mode() === 'existing') return !!this.existing();
    return (
      CODE_PATTERN.test(this.codeText().trim()) &&
      isWhole(this.discount(), 1, 100) &&
      isWhole(this.quantity(), 1, MAX_QUANTITY) &&
      !this.expiresProblem()
    );
  });
  protected readonly valid = computed(
    () => this.name().trim() !== '' && EMAIL_PATTERN.test(this.email().trim()) && this.codeValid(),
  );

  ngOnInit(): void {
    const referral = this.referral();
    if (!referral) return;
    this.name.set(referral.name);
    this.email.set(referral.email);
    this.phone.set(referral.phone ?? '');
    this.document.set(referral.document ?? '');
    this.notes.set(referral.notes ?? '');
  }

  protected pickMode(mode: string): void {
    this.mode.set(mode as CodeMode);
    if (mode === 'existing' && this.found().length === 0) void this.loadCodes('');
  }

  protected searchCodes(event: SelectFilterEvent): void {
    void this.loadCodes((event.filter ?? '').trim());
  }

  protected submit(): void {
    if (!this.valid()) return;
    const person = { name: this.name().trim(), email: this.email().trim() };
    if (this.referral()) {
      this.updated.emit({
        ...person,
        phone: this.phone().trim() || null,
        document: this.document().trim() || null,
        notes: this.notes().trim() || null,
      });
      return;
    }
    this.created.emit({
      ...person,
      phone: this.phone().trim() || undefined,
      document: this.document().trim() || undefined,
      notes: this.notes().trim() || undefined,
      ...(this.mode() === 'existing'
        ? { promotionalCodeId: this.existing() ?? undefined }
        : {
            code: {
              code: this.codeText().trim(),
              discount: Number(this.discount()),
              quantity: Number(this.quantity()),
              expiresAt: this.expires() ? endOfDayIso(this.expires()) : undefined,
            },
          }),
    });
  }

  private async loadCodes(search: string): Promise<void> {
    const current = this.latest.start();
    try {
      const page = await firstValueFrom(
        this.api.codes({ search: search || undefined, limit: OPTION_LIMIT }),
      );
      if (current()) this.found.set(page.items);
    } catch {
      if (current()) this.found.set([]);
    }
  }
}
