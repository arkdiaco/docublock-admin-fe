import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select, type SelectFilterEvent } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { LegalEntitiesApi } from '../data/legal-entities.api';
import type { SignerOption } from '../data/legal-entities.models';

@Component({
  selector: 'dba-legal-entity-signer-picker',
  imports: [TranslatePipe, FormsModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-select
      [inputId]="inputId()"
      [options]="options()"
      optionLabel="label"
      optionValue="id"
      [filter]="true"
      [showClear]="true"
      [resetFilterOnHide]="false"
      [placeholder]="'jur.picker.placeholder' | translate"
      [filterPlaceholder]="'jur.picker.filter' | translate"
      [emptyFilterMessage]="'jur.picker.empty' | translate"
      [ngModel]="value()"
      (ngModelChange)="pick($event)"
      (onFilter)="search($event)"
      (onShow)="warm()"
      appendTo="body"
      styleClass="form__select"
    />
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class LegalEntitySignerPickerComponent {
  readonly value = input<string | null>(null);
  readonly initial = input<SignerOption | null>(null);
  readonly inputId = input('');
  readonly picked = output<string | null>();

  private readonly api = inject(LegalEntitiesApi);
  private readonly latest = new LatestRequest();
  private readonly found = signal<SignerOption[]>([]);
  private readonly chosen = signal<SignerOption | null>(null);
  private warmed = false;

  protected readonly options = computed(() => {
    const kept = [this.chosen(), this.initial()].filter(
      (option): option is SignerOption => !!option && option.id === this.value(),
    );
    const first = kept.slice(0, 1);
    return [...first, ...this.found().filter((option) => option.id !== first[0]?.id)];
  });

  protected pick(id: string | null): void {
    this.chosen.set(this.options().find((option) => option.id === id) ?? null);
    this.picked.emit(id ?? null);
  }

  protected warm(): void {
    if (this.warmed) return;
    this.warmed = true;
    void this.load('');
  }

  protected search(event: SelectFilterEvent): void {
    void this.load((event.filter ?? '').trim());
  }

  private async load(term: string): Promise<void> {
    const current = this.latest.start();
    try {
      const items = await firstValueFrom(this.api.searchSigners(term));
      if (current()) this.found.set(items);
    } catch {
      if (current()) this.found.set([]);
    }
  }
}
