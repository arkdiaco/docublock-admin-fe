import { ChangeDetectionStrategy, Component, computed, input, output, signal, type OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { PropertyItem } from '../data/catalogs.models';

export const slugOf = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

@Component({
  selector: 'dba-property-item-form',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      [icon]="item() ? 'pencil' : 'plus'"
      [title]="(item() ? 'cat.property.editTitle' : 'cat.property.createTitle') | translate"
      [subtitle]="categoryLabel()"
      [confirmLabel]="item() ? 'cat.action.save' : 'cat.action.create'"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="500"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-field label="cat.property.label" [maxlength]="160" [(value)]="label" />
        <dba-field
          label="cat.property.key"
          [hint]="item() ? 'cat.property.keyLocked' : 'cat.property.keyHint'"
          [placeholder]="suggested()"
          [maxlength]="80"
          [disabled]="!!item()"
          mono
          [(value)]="key"
        />
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
export class PropertyItemFormComponent implements OnInit {
  readonly item = input<PropertyItem | null>(null);
  readonly categoryLabel = input('');
  readonly busy = input(false);
  readonly submitted = output<{ key: string; label: string; reason: string }>();
  readonly dismissed = output<void>();

  protected readonly key = signal('');
  protected readonly label = signal('');
  protected readonly reason = signal('');
  protected readonly suggested = computed(() => slugOf(this.label()));
  private readonly finalKey = computed(() => this.key().trim() || this.suggested());
  protected readonly canSave = computed(() => {
    if (!this.label().trim() || !this.reason().trim() || !this.finalKey()) return false;
    const item = this.item();
    return !item || this.label().trim() !== item.label;
  });

  ngOnInit(): void {
    this.key.set(this.item()?.key ?? '');
    this.label.set(this.item()?.label ?? '');
  }

  protected submit(): void {
    if (!this.canSave()) return;
    this.submitted.emit({
      key: this.finalKey(),
      label: this.label().trim(),
      reason: this.reason().trim(),
    });
  }
}
