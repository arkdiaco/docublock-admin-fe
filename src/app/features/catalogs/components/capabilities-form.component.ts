import { ChangeDetectionStrategy, Component, computed, input, output, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { CapabilitiesInput, CountryAddon, CountryDetail } from '../data/catalogs.models';

export const parseDocTypes = (value: string): string[] => [
  ...new Set(
    value
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
  ),
];

@Component({
  selector: 'dba-capabilities-form',
  imports: [FormsModule, TranslatePipe, ToggleSwitch, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="pencil"
      [title]="'cat.capabilities.editTitle' | translate"
      [subtitle]="country().name"
      confirmLabel="cat.action.save"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="dba-meta">{{ 'cat.capabilities.notice' | translate }}</p>
        <div class="form__switch form__switch--bare">
          <p-toggleswitch inputId="cap-company" [ngModel]="company()" (ngModelChange)="company.set($event)" />
          <label class="form__label" for="cap-company">{{ 'cat.capabilities.companyRegistry' | translate }}</label>
        </div>
        <div class="form__switch form__switch--bare">
          <p-toggleswitch inputId="cap-identity" [ngModel]="identity()" (ngModelChange)="identity.set($event)" />
          <label class="form__label" for="cap-identity">{{ 'cat.capabilities.identityRegistry' | translate }}</label>
        </div>
        @if (identity()) {
          <dba-field
            label="cat.capabilities.docTypes"
            hint="cat.capabilities.docTypesHint"
            mono
            [(value)]="docTypes"
          />
        }
        <div class="form__switch form__switch--bare">
          <p-toggleswitch inputId="cap-face" [ngModel]="faceMatch()" (ngModelChange)="faceMatch.set($event)" />
          <label class="form__label" for="cap-face">{{ 'cat.capabilities.registryFaceMatch' | translate }}</label>
        </div>
        <div class="form__switch form__switch--bare">
          <p-toggleswitch inputId="cap-card" [ngModel]="cardReader()" (ngModelChange)="cardReader.set($event)" />
          <label class="form__label" for="cap-card">{{ 'cat.capabilities.idCardReader' | translate }}</label>
        </div>
        <div class="form__switch form__switch--bare">
          <p-toggleswitch inputId="cap-sms" [ngModel]="sms()" (ngModelChange)="sms.set($event)" />
          <label class="form__label" for="cap-sms">{{ 'cat.capabilities.sms' | translate }}</label>
        </div>
        <div class="form__switch form__switch--bare">
          <p-toggleswitch inputId="cap-pagares" [ngModel]="pagares()" (ngModelChange)="pagares.set($event)" />
          <label class="form__label" for="cap-pagares">{{ 'cat.capabilities.pagares' | translate }}</label>
        </div>
        <div class="form__switch form__switch--bare">
          <p-toggleswitch inputId="cap-realestate" [ngModel]="realEstate()" (ngModelChange)="realEstate.set($event)" />
          <label class="form__label" for="cap-realestate">{{ 'cat.capabilities.bienes_raices' | translate }}</label>
        </div>
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class CapabilitiesFormComponent implements OnInit {
  readonly country = input.required<CountryDetail>();
  readonly busy = input(false);
  readonly submitted = output<{ input: CapabilitiesInput; reason: string }>();
  readonly dismissed = output<void>();

  protected readonly company = signal(false);
  protected readonly identity = signal(false);
  protected readonly docTypes = signal('');
  protected readonly faceMatch = signal(false);
  protected readonly cardReader = signal(false);
  protected readonly sms = signal(false);
  protected readonly pagares = signal(false);
  protected readonly realEstate = signal(false);
  protected readonly reason = signal('');
  private readonly addons = computed<CountryAddon[]>(() => [
    ...(this.pagares() ? (['pagares'] as const) : []),
    ...(this.realEstate() ? (['bienes_raices'] as const) : []),
  ]);

  ngOnInit(): void {
    const caps = this.country().capabilities;
    this.company.set(!!caps.companyRegistry);
    this.identity.set(!!caps.identityRegistry);
    this.docTypes.set((caps.identityRegistry?.docTypes ?? []).join(', '));
    this.faceMatch.set(!!caps.registryFaceMatch);
    this.cardReader.set(!!caps.idCardReader);
    this.sms.set(caps.sms);
    this.pagares.set(caps.addons.includes('pagares'));
    this.realEstate.set(caps.addons.includes('bienes_raices'));
  }

  protected submit(): void {
    const reason = this.reason().trim();
    if (!reason) return;
    this.submitted.emit({
      reason,
      input: {
        companyRegistry: this.company(),
        identityRegistry: this.identity(),
        docTypes: parseDocTypes(this.docTypes()),
        registryFaceMatch: this.faceMatch(),
        idCardReader: this.cardReader(),
        sms: this.sms(),
        addons: this.addons(),
      },
    });
  }
}
