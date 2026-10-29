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
import { TranslatePipe } from '@ngx-translate/core';
import { Select, type SelectFilterEvent } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../../shared/http/latest-request';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import { wholeNumber } from '../../data/form-values';
import { OrganizationsApi } from '../../data/organizations.api';
import type { PlatformOrgRow } from '../../data/organizations.models';

export interface TransferDocumentsBody {
  targetOrganizationId: string;
  documents: number;
  reason: string;
}

@Component({
  selector: 'dba-transfer-documents-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="send"
      [title]="'sub.transfer.title' | translate"
      [subtitle]="orgName()"
      confirmLabel="sub.transfer.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="dba-body form__note--top">
          {{ 'sub.transfer.available' | translate: { count: available() } }}
        </p>
        <div class="form__control">
          <label class="form__label" for="transfer-target">{{
            'sub.transfer.target' | translate
          }}</label>
          <p-select
            inputId="transfer-target"
            [options]="options()"
            optionLabel="label"
            optionValue="id"
            [filter]="true"
            [resetFilterOnHide]="false"
            [placeholder]="'sub.transfer.targetPlaceholder' | translate"
            [emptyFilterMessage]="'sub.transfer.targetEmpty' | translate"
            [ngModel]="targetId()"
            (ngModelChange)="targetId.set($event)"
            (onFilter)="search($event)"
            appendTo="body"
            styleClass="form__select"
          />
          @if (target(); as t) {
            <span class="dba-meta">{{ targetText(t) }}</span>
          }
        </div>
        <dba-field
          label="sub.transfer.amount"
          inputmode="numeric"
          [error]="amountError()"
          [(value)]="amount"
        />
        @if (summary(); as s) {
          <div class="form__summary">
            <span>{{
              'sub.transfer.sourceAfter' | translate: { name: orgName(), count: s.source }
            }}</span>
            <span>{{ s.target }}</span>
          </div>
        }
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../modal-form.scss',
})
export class TransferDocumentsFormComponent implements OnInit {
  private readonly api = inject(OrganizationsApi);
  private readonly latest = new LatestRequest();

  readonly orgId = input.required<string>();
  readonly orgName = input.required<string>();
  readonly available = input.required<number>();
  readonly texts = input.required<{
    targetHas: (row: PlatformOrgRow) => string;
    targetAfter: (row: PlatformOrgRow, amount: number) => string;
  }>();
  readonly busy = input(false);
  readonly submitted = output<TransferDocumentsBody>();
  readonly dismissed = output<void>();

  protected readonly targetId = signal<string | null>(null);
  protected readonly amount = signal('');
  protected readonly reason = signal('');
  private readonly rows = signal<PlatformOrgRow[]>([]);

  protected readonly options = computed(() =>
    this.rows()
      .filter((row) => row.id !== this.orgId())
      .map((row) => ({ id: row.id, label: `${row.businessName} · ${row.tributaryNumber}` })),
  );

  protected readonly target = computed(
    () => this.rows().find((row) => row.id === this.targetId()) ?? null,
  );

  protected readonly value = computed(() => wholeNumber(this.amount()));

  protected readonly amountError = computed(() => {
    if (!this.amount().trim()) return '';
    const value = this.value();
    if (value === null || value < 1) return 'sub.error.wholeNumber';
    return value > this.available() ? 'sub.transfer.tooMany' : '';
  });

  protected readonly summary = computed(() => {
    const target = this.target();
    const value = this.value();
    if (!target || value === null || this.amountError()) return null;
    return {
      source: this.available() - value,
      target: this.texts().targetAfter(target, value),
    };
  });

  protected readonly valid = computed(
    () =>
      !!this.target() &&
      this.target()!.documents.limit !== null &&
      this.value() !== null &&
      !this.amountError() &&
      !!this.reason().trim(),
  );

  ngOnInit(): void {
    void this.load('');
  }

  protected targetText(row: PlatformOrgRow): string {
    return this.texts().targetHas(row);
  }

  protected search(event: SelectFilterEvent): void {
    void this.load(event.filter ?? '');
  }

  protected submit(): void {
    const value = this.value();
    const target = this.targetId();
    if (!this.valid() || value === null || !target) return;
    this.submitted.emit({
      targetOrganizationId: target,
      documents: value,
      reason: this.reason().trim(),
    });
  }

  private async load(search: string): Promise<void> {
    const current = this.latest.start();
    try {
      const page = await firstValueFrom(
        this.api.list({ search: search.trim() || undefined, limit: 20, page: 1 }),
      );
      if (!current()) return;
      const seen = new Map(this.rows().map((row) => [row.id, row]));
      for (const row of page.items) seen.set(row.id, row);
      this.rows.set([...seen.values()]);
    } catch {
      return;
    }
  }
}
