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
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import type { ProductDetail, ProductTexts } from '../data/marketplace.models';
import { bulletsOf } from '../data/product-format';

@Component({
  selector: 'dba-product-texts-form',
  imports: [TranslatePipe, ModalShellComponent, FieldComponent, TextAreaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="pencil"
      [title]="'mkt.texts.title' | translate"
      [subtitle]="product().name + ' · ' + product().code"
      confirmLabel="mkt.texts.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="640"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="dba-meta form__note--top">{{ 'mkt.texts.lead' | translate }}</p>
        <dba-field
          label="mkt.f.name"
          [maxlength]="120"
          [error]="name().trim().length >= 2 ? '' : 'common.required'"
          [(value)]="name"
        />
        <dba-text-area label="mkt.f.summary" [maxlength]="600" [rows]="3" [(value)]="summary" />
        <dba-text-area
          label="mkt.f.bullets"
          hint="mkt.form.bulletsHint"
          [error]="bulletsError()"
          [rows]="4"
          [(value)]="bullets"
        />
        <dba-text-area
          label="mkt.f.limitations"
          [maxlength]="1000"
          [rows]="3"
          [(value)]="limitations"
        />
        <dba-field
          label="mkt.f.reason"
          placeholder="mkt.form.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class ProductTextsFormComponent implements OnInit {
  readonly product = input.required<ProductDetail>();
  readonly busy = input(false);
  readonly submitted = output<{ texts: ProductTexts; reason: string }>();
  readonly dismissed = output<void>();

  protected readonly name = signal('');
  protected readonly summary = signal('');
  protected readonly bullets = signal('');
  protected readonly limitations = signal('');
  protected readonly reason = signal('');

  protected readonly bulletsError = computed(() => {
    const lines = bulletsOf(this.bullets());
    if (lines.length > 8) return 'mkt.form.bulletsTooMany';
    return lines.some((line) => line.length > 200) ? 'mkt.form.bulletTooLong' : '';
  });

  protected readonly texts = computed<ProductTexts>(() => ({
    name: this.name().trim(),
    summary: this.summary().trim(),
    bullets: bulletsOf(this.bullets()),
    limitations: this.limitations().trim(),
  }));

  protected readonly changed = computed(() => {
    const p = this.product();
    const t = this.texts();
    return (
      p.name !== t.name ||
      p.summary !== t.summary ||
      p.limitations !== t.limitations ||
      p.bullets.join('\n') !== t.bullets.join('\n')
    );
  });

  protected readonly valid = computed(
    () =>
      this.name().trim().length >= 2 &&
      !this.bulletsError() &&
      this.changed() &&
      !!this.reason().trim(),
  );

  ngOnInit(): void {
    const p = this.product();
    this.name.set(p.name);
    this.summary.set(p.summary);
    this.bullets.set(p.bullets.join('\n'));
    this.limitations.set(p.limitations);
  }

  protected submit(): void {
    if (!this.valid()) return;
    this.submitted.emit({ texts: this.texts(), reason: this.reason().trim() });
  }
}
