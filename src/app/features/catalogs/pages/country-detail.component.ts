import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { initialsOf } from '../../../shared/domain/initials';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  TargetHistoryComponent,
  type TargetHistoryLoader,
} from '../../../shared/ui/target-history.component';
import { CapabilitiesFormComponent } from '../components/capabilities-form.component';
import { CountryFormComponent, type CountryFormResult } from '../components/country-form.component';
import { askRemovalReason } from '../data/catalog-removal';
import { CatalogsApi, catalogErrorKey, catalogUsageOf } from '../data/catalogs.api';
import type { CapabilitiesInput, CountryDetail } from '../data/catalogs.models';

const FLAGS = ['companyRegistry', 'identityRegistry', 'registryFaceMatch', 'idCardReader'] as const;

@Component({
  selector: 'dba-country-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    CapabilitiesFormComponent,
    CountryFormComponent,
    EmptyStateComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
    TargetHistoryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'cat.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="cat.countries.missingTitle" leadKey="cat.countries.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]">{{ 'cat.countries.back' | translate }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="cat.errorTitle" leadKey="cat.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">{{ 'common.retry' | translate }}</button>
      </div>
    } @else if (country(); as item) {
      <div class="bd">
        <dba-record-header [initials]="initials()" [title]="item.name" [meta]="item.abbreviation" />

        @if (canManage()) {
          <div class="bd__actions">
            <button dba-button variant="secondary" (click)="editing.set(true)">
              {{ 'cat.countries.edit' | translate }}
            </button>
            <button dba-button variant="secondary" (click)="editingCapabilities.set(true)">
              {{ 'cat.capabilities.edit' | translate }}
            </button>
            <button
              dba-button
              variant="destructive"
              [busy]="pending.key() === 'remove'"
              [disabled]="!!pending.key()"
              (click)="remove(item)"
            >
              {{ 'cat.action.remove' | translate }}
            </button>
          </div>
        }

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'cat.countries.profile' | translate }}</h2>
          <p class="dba-meta">{{ 'cat.countries.profileNotice' | translate }}</p>
          <dl class="bd__dl">
            <dt>{{ 'cat.countries.callingCode' | translate }}</dt>
            <dd class="dba-mono">{{ item.callingCode || '—' }}</dd>
            <dt>{{ 'cat.countries.currency' | translate }}</dt>
            <dd class="dba-mono">{{ item.currency || '—' }}</dd>
            <dt>{{ 'cat.countryForm.locale' | translate }}</dt>
            <dd class="dba-mono">{{ item.locale || '—' }}</dd>
            <dt>{{ 'cat.countries.timezone' | translate }}</dt>
            <dd>{{ item.timezone || '—' }}</dd>
            <dt>{{ 'cat.countryForm.taxLabel' | translate }}</dt>
            <dd>{{ item.taxId.label || '—' }}</dd>
            <dt>{{ 'cat.countryForm.taxExample' | translate }}</dt>
            <dd class="dba-mono">{{ item.taxId.example || '—' }}</dd>
            <dt>{{ 'cat.countryForm.taxPattern' | translate }}</dt>
            <dd class="dba-mono">{{ item.taxId.pattern || '—' }}</dd>
            <dt>{{ 'cat.countryForm.resolution' | translate }}</dt>
            <dd>{{ item.resolution || ('cat.countries.genericResolution' | translate) }}</dd>
          </dl>
        </section>

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'cat.countries.catalogs' | translate }}</h2>
          <dl class="bd__dl">
            <dt>{{ 'nav.cities' | translate }}</dt>
            <dd>
              <a class="bd__link" [routerLink]="[citiesPath]" [queryParams]="{ pais: item.id }">{{ item.citiesCount }}</a>
            </dd>
            <dt>{{ 'nav.kindPersons' | translate }}</dt>
            <dd>
              <a class="bd__link" [routerLink]="[kindsPath]" [queryParams]="{ pais: item.id }">{{ item.kindPersonsCount }}</a>
            </dd>
            <dt>{{ 'nav.identificationTypes' | translate }}</dt>
            <dd>
              <a class="bd__link" [routerLink]="[typesPath]" [queryParams]="{ pais: item.id }">{{ item.identificationTypesCount }}</a>
            </dd>
            <dt>{{ 'nav.signerFields' | translate }}</dt>
            <dd>
              <a class="bd__link" [routerLink]="[fieldsPath]" [queryParams]="{ pais: item.id }">{{
                'cat.countries.openFields' | translate
              }}</a>
            </dd>
          </dl>
        </section>

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'cat.capabilities.title' | translate }}</h2>
          <dl class="bd__dl">
            @for (flag of flags; track flag) {
              <dt>{{ 'cat.capabilities.' + flag | translate }}</dt>
              <dd>{{ (item.capabilities[flag] ? 'cat.on' : 'cat.off') | translate }}</dd>
            }
            @if (item.capabilities.identityRegistry; as registry) {
              <dt>{{ 'cat.capabilities.docTypes' | translate }}</dt>
              <dd class="dba-mono">{{ registry.docTypes.join(', ') || '—' }}</dd>
            }
            <dt>{{ 'cat.capabilities.sms' | translate }}</dt>
            <dd>{{ (item.capabilities.sms ? 'cat.on' : 'cat.off') | translate }}</dd>
            <dt>{{ 'cat.capabilities.pagares' | translate }}</dt>
            <dd>{{ (item.capabilities.addons.includes('pagares') ? 'cat.on' : 'cat.off') | translate }}</dd>
            <dt>{{ 'cat.capabilities.bienes_raices' | translate }}</dt>
            <dd>{{ (item.capabilities.addons.includes('bienes_raices') ? 'cat.on' : 'cat.off') | translate }}</dd>
          </dl>
        </section>

        @if (canSeeHistory()) {
          <section class="bd__card">
            <h2 class="dba-panel">{{ 'cat.countries.history' | translate }}</h2>
            <dba-target-history [load]="history()" />
          </section>
        }
      </div>

      @if (editing()) {
        <dba-country-form
          [country]="item"
          [busy]="pending.key() === 'edit'"
          (submitted)="save($event)"
          (dismissed)="editing.set(false)"
        />
      }
      @if (editingCapabilities()) {
        <dba-capabilities-form
          [country]="item"
          [busy]="pending.key() === 'capabilities'"
          (submitted)="saveCapabilities($event)"
          (dismissed)="editingCapabilities.set(false)"
        />
      }
    }
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
})
export class CountryDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(CatalogsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly flags = FLAGS;
  protected readonly path = sectionPath('countries');
  protected readonly citiesPath = sectionPath('cities');
  protected readonly kindsPath = sectionPath('kindPersons');
  protected readonly typesPath = sectionPath('identificationTypes');
  protected readonly fieldsPath = sectionPath('signerFields');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly canSeeHistory = computed(() => this.auth.canRead('platform'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly editing = signal(false);
  protected readonly editingCapabilities = signal(false);
  protected readonly country = signal<CountryDetail | null>(null);
  protected readonly initials = computed(() => initialsOf(this.country()?.name ?? ''));
  private readonly revision = signal(0);
  protected readonly history = computed<TargetHistoryLoader>(() => {
    const id = this.id();
    this.revision();
    return (page, limit) => this.api.countryHistory(id, page, limit);
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  protected reload(): void {
    void this.load(this.id());
  }

  protected async save(result: CountryFormResult): Promise<void> {
    if (result.kind !== 'edit') return;
    await this.pending.run('edit', async () => {
      try {
        this.country.set(
          await firstValueFrom(this.api.updateCountry(this.id(), result.changes, result.reason)),
        );
        this.editing.set(false);
        this.revision.update((value) => value + 1);
        this.notify.success(this.label('cat.countries.updated'));
      } catch (error) {
        this.notify.error(this.label(catalogErrorKey(error)));
      }
    });
  }

  protected async saveCapabilities(result: {
    input: CapabilitiesInput;
    reason: string;
  }): Promise<void> {
    await this.pending.run('capabilities', async () => {
      try {
        this.country.set(
          await firstValueFrom(
            this.api.updateCapabilities(this.id(), result.input, result.reason),
          ),
        );
        this.editingCapabilities.set(false);
        this.revision.update((value) => value + 1);
        this.notify.success(this.label('cat.capabilities.updated'));
      } catch (error) {
        this.notify.error(this.label(catalogErrorKey(error)));
      }
    });
  }

  protected async remove(country: CountryDetail): Promise<void> {
    const reason = await askRemovalReason(this.dialogs, country.name, 'cat.countries.removeMessage');
    if (!reason) return;
    await this.pending.run('remove', async () => {
      try {
        await firstValueFrom(this.api.removeCountry(country.id, reason));
        this.notify.success(this.label('cat.countries.removed'));
        await this.router.navigate([this.path]);
      } catch (error) {
        this.notify.error(this.label(catalogErrorKey(error), { usage: catalogUsageOf(error) }));
      }
    });
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    this.missing.set(false);
    try {
      const country = await firstValueFrom(this.api.country(id));
      if (!current()) return;
      this.country.set(country);
    } catch (error) {
      if (!current()) return;
      if (errorStatusOf(error) === 404) this.missing.set(true);
      else this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
