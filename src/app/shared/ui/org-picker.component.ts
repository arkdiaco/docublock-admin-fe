import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select, type SelectFilterEvent } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../http/latest-request';
import {
  OrganizationLookup,
  type LookupScope,
  type OrganizationOption,
} from '../http/organization-lookup';

const ANY = '';

@Component({
  selector: 'dba-org-picker',
  imports: [TranslatePipe, FormsModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-select
      [options]="options()"
      optionLabel="label"
      optionValue="id"
      [filter]="true"
      [resetFilterOnHide]="false"
      [filterPlaceholder]="'orgPicker.filter' | translate"
      [emptyFilterMessage]="'orgPicker.empty' | translate"
      [ngModel]="value() ?? ''"
      (ngModelChange)="pick($event)"
      (onFilter)="search($event)"
      (onShow)="warm()"
      [ariaLabel]="labelKey() | translate"
      appendTo="body"
      styleClass="pick"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      max-width: 100%;
    }

    :host ::ng-deep .pick.p-select {
      width: 240px;
      max-width: 100%;
      height: var(--dba-height-control);
    }

    @media (max-width: 520px) {
      :host {
        width: 100%;
      }

      :host ::ng-deep .pick.p-select {
        width: 100%;
      }
    }
  `,
})
export class OrgPickerComponent {
  private readonly lookup = inject(OrganizationLookup);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  readonly value = input<string | null>(null);
  readonly scope = input<LookupScope>('clients');
  readonly anyKey = input('orgPicker.any');
  readonly labelKey = input('orgPicker.label');
  readonly picked = output<string | null>();
  readonly selection = output<OrganizationOption | null>();

  private readonly found = signal<OrganizationOption[]>([]);
  private readonly selected = signal<OrganizationOption | null>(null);
  private warmed = false;

  protected readonly options = computed(() => {
    const chosen = this.selected();
    const rest = this.found().filter((org) => org.id !== chosen?.id);
    return [
      { id: ANY, label: this.translate.instant(this.anyKey()) as string },
      ...(chosen ? [chosen] : []).concat(rest).map((org) => ({
        id: org.id,
        label: org.tributaryNumber
          ? `${org.businessName} · ${org.tributaryNumber}`
          : org.businessName,
      })),
    ];
  });

  constructor() {
    effect(() => {
      const id = this.value();
      untracked(() => void this.resolve(id));
    });
  }

  protected pick(id: string): void {
    const chosen = this.found().find((org) => org.id === id) ?? null;
    if (chosen) this.selected.set(chosen);
    this.picked.emit(id || null);
    this.selection.emit(chosen);
  }

  protected warm(): void {
    if (this.warmed) return;
    this.warmed = true;
    void this.load('');
  }

  protected search(event: SelectFilterEvent): void {
    void this.load((event.filter ?? '').trim());
  }

  private async resolve(id: string | null): Promise<void> {
    if (!id) {
      this.selected.set(null);
      return;
    }
    if (this.selected()?.id === id) return;
    const known = this.found().find((org) => org.id === id);
    if (known) {
      this.selected.set(known);
      return;
    }
    try {
      this.selected.set(await firstValueFrom(this.lookup.byId(id, this.scope())));
    } catch {
      this.selected.set(null);
    }
  }

  private async load(term: string): Promise<void> {
    const current = this.latest.start();
    try {
      const items = await firstValueFrom(this.lookup.search(term, this.scope()));
      if (current()) this.found.set(items);
    } catch {
      if (current()) this.found.set([]);
    }
  }
}
