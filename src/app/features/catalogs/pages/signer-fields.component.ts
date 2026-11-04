import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DensityService } from '../../../core/preferences/density.service';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CatalogCountrySelectComponent } from '../components/catalog-country-select.component';
import { CATALOG_REASON } from '../data/catalog-removal';
import { CatalogsApi, catalogErrorKey } from '../data/catalogs.api';
import {
  POLICY_FIELDS,
  type CountryOption,
  type DirectoryMode,
  type FieldRule,
  type FieldRules,
  type PolicyField,
  type SignerPolicy,
} from '../data/catalogs.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'field', labelKey: 'cat.fields.field', width: 'minmax(0, 1.4fr)' },
  { key: 'natural', labelKey: 'cat.kind.natural', width: 'minmax(170px, 1fr)' },
  { key: 'legal', labelKey: 'cat.kind.legal', width: 'minmax(170px, 1fr)' },
];

type Kind = 'natural' | 'legal';

const sameRules = (a: FieldRules, b: FieldRules): boolean =>
  POLICY_FIELDS.every((field) => a[field] === b[field]);

@Component({
  selector: 'dba-signer-fields',
  imports: [
    FormsModule,
    TranslatePipe,
    Select,
    ButtonComponent,
    CatalogCountrySelectComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.signerFields' | translate }}</h1>
          @if (policy(); as current) {
            <span class="dba-meta">{{
              (current.customFields || current.customDirectory ? 'cat.fields.custom' : 'cat.fields.default')
                | translate
            }}</span>
          }
        </div>
      </header>

      <p class="dba-meta">{{ 'cat.fields.notice' | translate }}</p>

      <div class="bl__tools">
        <dba-catalog-country-select
          [allowAll]="false"
          [value]="countryId()"
          (picked)="pickCountry($event)"
          (loaded)="onCountries($event)"
        />
        <p-select
          [options]="modes()"
          optionLabel="label"
          optionValue="id"
          [disabled]="!canManage()"
          [ngModel]="directory()"
          (ngModelChange)="directory.set($event)"
          [ariaLabel]="'cat.fields.directory' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>
      <p class="dba-meta">{{ 'cat.fields.directoryHint.' + directory() | translate }}</p>

      @if (loading()) {
        <db-section-loader [label]="'cat.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="cat.errorTitle" leadKey="cat.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (policy()) {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.signerFields' | translate"
          [dense]="density.compact()"
          minWidth="620px"
        >
          @for (field of fields; track field) {
            <div class="dba-tr">
              <span class="dba-td cell">
                <span class="cell__label">{{ 'cat.fields.name.' + field | translate }}</span>
              </span>
              @for (kind of kinds; track kind) {
                <span class="dba-td">
                  <p-select
                    [options]="rules()"
                    optionLabel="label"
                    optionValue="id"
                    [disabled]="!canManage()"
                    [ngModel]="ruleOf(kind, field)"
                    (ngModelChange)="setRule(kind, field, $event)"
                    [ariaLabel]="('cat.fields.name.' + field | translate) + ' · ' + ('cat.kind.' + kind | translate)"
                    appendTo="body"
                    styleClass="rule-select"
                  />
                </span>
              }
            </div>
          }
        </dba-data-table>

        @if (canManage()) {
          <dba-field
            label="sub.reasonLabel"
            placeholder="sub.reasonPlaceholder"
            [maxlength]="500"
            [(value)]="reason"
          />
          <div class="bl__actions">
            <button
              dba-button
              [disabled]="!canSave() || !!pending.key()"
              [busy]="pending.key() === 'save'"
              (click)="save()"
            >
              {{ 'cat.action.save' | translate }}
            </button>
            @if (policy()?.customFields || policy()?.customDirectory) {
              <button
                dba-button
                variant="secondary"
                [disabled]="!!pending.key()"
                [busy]="pending.key() === 'reset'"
                (click)="reset()"
              >
                {{ 'cat.fields.reset' | translate }}
              </button>
            }
          </div>
        }
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    :host ::ng-deep .rule-select.p-select {
      width: 100%;
      max-width: 200px;
    }

    .bl__actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
  `,
})
export class SignerFieldsComponent {
  readonly pais = input<string | undefined>();

  private readonly api = inject(CatalogsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly fields = POLICY_FIELDS;
  protected readonly kinds: readonly Kind[] = ['natural', 'legal'];
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly countryId = signal('');
  protected readonly policy = signal<SignerPolicy | null>(null);
  protected readonly directory = signal<DirectoryMode>('ORG_ONLY');
  protected readonly natural = signal<FieldRules | null>(null);
  protected readonly legal = signal<FieldRules | null>(null);
  protected readonly reason = signal('');
  protected readonly modes = computed(() => [
    { id: 'ORG_ONLY', label: this.label('cat.fields.mode.ORG_ONLY') },
    { id: 'OPEN', label: this.label('cat.fields.mode.OPEN') },
  ]);
  protected readonly rules = computed(() =>
    (['required', 'optional', 'hidden'] as const).map((rule) => ({
      id: rule,
      label: this.label(`cat.fields.rule.${rule}`),
    })),
  );
  private readonly dirty = computed(() => {
    const policy = this.policy();
    const natural = this.natural();
    const legal = this.legal();
    if (!policy || !natural || !legal) return false;
    return (
      this.directory() !== policy.directory ||
      !sameRules(natural, policy.fields.natural.fields) ||
      !sameRules(legal, policy.fields.legal.fields)
    );
  });
  protected readonly canSave = computed(() => this.dirty() && !!this.reason().trim());

  constructor() {
    effect(() => {
      const country = this.pais() ?? '';
      untracked(() => {
        if (country) this.pickCountry(country);
      });
    });
  }

  protected onCountries(countries: CountryOption[]): void {
    if (!this.countryId() && countries[0]) this.pickCountry(countries[0].id);
  }

  protected pickCountry(countryId: string): void {
    this.countryId.set(countryId);
    this.reason.set('');
    void this.reload();
  }

  protected ruleOf(kind: Kind, field: PolicyField): FieldRule {
    return (kind === 'natural' ? this.natural() : this.legal())?.[field] ?? 'optional';
  }

  protected setRule(kind: Kind, field: PolicyField, rule: FieldRule): void {
    const target = kind === 'natural' ? this.natural : this.legal;
    target.update((rules) => (rules ? { ...rules, [field]: rule } : rules));
  }

  protected async save(): Promise<void> {
    const natural = this.natural();
    const legal = this.legal();
    if (!this.canSave() || !natural || !legal) return;
    await this.pending.run('save', async () => {
      try {
        this.apply(
          await firstValueFrom(
            this.api.saveSignerPolicy(
              this.countryId(),
              { directory: this.directory(), natural, legal },
              this.reason().trim(),
            ),
          ),
        );
        this.reason.set('');
        this.notify.success(this.label('cat.fields.saved'));
      } catch (error) {
        this.notify.error(this.label(catalogErrorKey(error)));
      }
    });
  }

  protected async reset(): Promise<void> {
    const answer = await this.dialogs.open({
      icon: 'pencil',
      title: 'cat.fields.resetTitle',
      message: 'cat.fields.resetMessage',
      confirmLabel: 'cat.fields.reset',
      reason: CATALOG_REASON,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    const reason = answer.reason;
    await this.pending.run('reset', async () => {
      try {
        this.apply(await firstValueFrom(this.api.resetSignerPolicy(this.countryId(), reason)));
        this.reason.set('');
        this.notify.success(this.label('cat.fields.resetDone'));
      } catch (error) {
        this.notify.error(this.label(catalogErrorKey(error)));
      }
    });
  }

  protected async reload(): Promise<void> {
    const countryId = this.countryId();
    if (!countryId) return;
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const policy = await firstValueFrom(this.api.signerPolicy(countryId));
      if (!current()) return;
      this.apply(policy);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private apply(policy: SignerPolicy): void {
    this.policy.set(policy);
    this.directory.set(policy.directory);
    this.natural.set({ ...policy.fields.natural.fields });
    this.legal.set({ ...policy.fields.legal.fields });
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
