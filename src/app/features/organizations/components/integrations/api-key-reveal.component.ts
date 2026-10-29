import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { IconComponent } from '../../../../shared/ui/icon.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';

@Component({
  selector: 'dba-api-key-reveal',
  imports: [TranslatePipe, ButtonComponent, IconComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="lock"
      [title]="'integ.reveal.title' | translate"
      [subtitle]="orgName()"
      confirmLabel="integ.reveal.done"
      [cancelable]="false"
      [maxWidth]="560"
      (confirmed)="closed.emit()"
      (dismissed)="closed.emit()"
    >
      <div class="rv">
        <p class="dba-body rv__lead">{{ 'integ.reveal.lead' | translate }}</p>
        <code class="rv__key">{{ apiKey() }}</code>
        <div class="rv__actions">
          <button dba-button variant="secondary" (click)="copy()">
            <db-icon [name]="copied() ? 'check' : 'copy'" [size]="15" />
            {{ (copied() ? 'integ.reveal.copied' : 'integ.reveal.copy') | translate }}
          </button>
        </div>
      </div>
    </db-modal-shell>
  `,
  styles: `
    .rv {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .rv__lead {
      margin: 0;
      color: var(--dba-text);
    }

    .rv__key {
      display: block;
      max-height: 160px;
      overflow: auto;
      padding: 12px 14px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface-muted);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
      user-select: all;
    }

    .rv__actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class ApiKeyRevealComponent {
  readonly apiKey = input.required<string>();
  readonly orgName = input.required<string>();
  readonly closed = output<void>();

  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.apiKey());
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }
}
