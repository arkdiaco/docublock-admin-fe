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
import { LatestRequest } from '../../../shared/http/latest-request';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrganizationsApi } from '../data/organizations.api';
import type { PlatformOrgDetail, ResellerOption } from '../data/organizations.models';

const NONE = '';

@Component({
  selector: 'dba-reseller-picker',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="chain"
      [title]="'orgReseller.title' | translate"
      [subtitle]="org().businessName"
      confirmLabel="orgReseller.save"
      [confirmDisabled]="!changed()"
      [busy]="busy()"
      [maxWidth]="480"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="pick">
        <label class="pick__label" for="org-reseller">{{ 'orgReseller.field' | translate }}</label>
        <p-select
          inputId="org-reseller"
          [options]="options()"
          optionLabel="label"
          optionValue="id"
          [filter]="true"
          [resetFilterOnHide]="false"
          [emptyFilterMessage]="'orgReseller.empty' | translate"
          [ngModel]="choice()"
          (ngModelChange)="choice.set($event)"
          (onFilter)="search($event)"
          appendTo="body"
          styleClass="pick__select"
        />
        <p class="dba-meta pick__note">{{ 'orgReseller.note' | translate }}</p>
      </div>
    </db-modal-shell>
  `,
  styles: `
    .pick {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .pick__label {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    ::ng-deep .pick__select.p-select {
      width: 100%;
      height: var(--dba-height-control);
    }

    .pick__note {
      margin: 6px 0 0;
    }
  `,
})
export class ResellerPickerComponent implements OnInit {
  private readonly api = inject(OrganizationsApi);
  private readonly latest = new LatestRequest();

  readonly org = input.required<PlatformOrgDetail>();
  readonly noneLabel = input.required<string>();
  readonly busy = input(false);
  readonly submitted = output<string | null>();
  readonly dismissed = output<void>();

  protected readonly choice = signal(NONE);
  private readonly found = signal<ResellerOption[]>([]);

  protected readonly options = computed(() => {
    const org = this.org();
    const own =
      org.resellerId && org.resellerName
        ? [{ id: org.resellerId, businessName: org.resellerName, tributaryNumber: '' }]
        : [];
    const list = [
      ...own,
      ...this.found().filter((r) => r.id !== org.resellerId && r.id !== org.id),
    ];
    return [
      { id: NONE, label: this.noneLabel() },
      ...list.map((r) => ({
        id: r.id,
        label: r.tributaryNumber ? `${r.businessName} · ${r.tributaryNumber}` : r.businessName,
      })),
    ];
  });

  protected readonly changed = computed(() => this.choice() !== (this.org().resellerId ?? NONE));

  ngOnInit(): void {
    this.choice.set(this.org().resellerId ?? NONE);
    void this.load('');
  }

  protected search(event: SelectFilterEvent): void {
    void this.load(event.filter ?? '');
  }

  protected submit(): void {
    if (this.changed()) this.submitted.emit(this.choice() || null);
  }

  private async load(search: string): Promise<void> {
    const current = this.latest.start();
    try {
      const items = await firstValueFrom(this.api.resellers(search.trim()));
      if (!current()) return;
      const seen = new Map(this.found().map((r) => [r.id, r]));
      for (const item of items) seen.set(item.id, item);
      this.found.set([...seen.values()]);
    } catch {
      return;
    }
  }
}
