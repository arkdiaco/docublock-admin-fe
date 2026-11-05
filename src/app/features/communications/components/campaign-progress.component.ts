import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { CommunicationsApi } from '../data/communications.api';
import type { CampaignView } from '../data/communications.models';

const POLL_MS = 3000;

@Component({
  selector: 'dba-campaign-progress',
  imports: [TranslatePipe, ButtonComponent, StatBandComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="progress" aria-live="polite">
      <h2 class="dba-panel">{{ (finished() ? 'comm.progress.finished' : 'comm.progress.sending') | translate }}</h2>
      <db-stat-band [cells]="cells()" [label]="'comm.progress.sending' | translate" />
      @if (stale()) {
        <p class="dba-meta" role="status">{{ 'comm.progress.stale' | translate }}</p>
      } @else if (!finished()) {
        <p class="dba-meta">{{ 'comm.progress.lead' | translate }}</p>
      }
      <p class="dba-meta">{{ 'comm.progress.accepted' | translate }}</p>
      @if (finished()) {
        <div>
          <button dba-button variant="secondary" (click)="restart.emit()">
            {{ 'comm.progress.again' | translate }}
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .progress {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 28px;
    }

    .progress p {
      margin: 0;
    }
  `,
})
export class CampaignProgressComponent {
  readonly campaign = input.required<CampaignView>();
  readonly restart = output<void>();

  private readonly api = inject(CommunicationsApi);
  private readonly translate = inject(TranslateService);
  private readonly latest = signal<CampaignView | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly stale = signal(false);
  private readonly current = computed(() => this.latest() ?? this.campaign());
  protected readonly finished = computed(() => this.current().state === 'finished');

  protected readonly cells = computed((): StatCell[] => {
    const { sent, failed, pending, sending, excluded } = this.current().counts;
    return [
      { key: 'sent', label: this.label('comm.progress.sent'), value: String(sent) },
      {
        key: 'failed',
        label: this.label('comm.progress.failed'),
        value: String(failed),
        tone: failed > 0 ? 'danger' : 'plain',
      },
      { key: 'pending', label: this.label('comm.progress.pending'), value: String(pending + sending) },
      { key: 'excluded', label: this.label('comm.progress.excluded'), value: String(excluded) },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
    effect(() => {
      this.campaign();
      untracked(() => {
        this.stop();
        this.latest.set(null);
        this.schedule();
      });
    });
  }

  private schedule(): void {
    if (this.finished()) return;
    this.timer = setTimeout(() => void this.poll(), POLL_MS);
  }

  private async poll(): Promise<void> {
    const id = this.campaign().id;
    try {
      const next = await firstValueFrom(this.api.campaign(id));
      this.latest.set(next);
      this.stale.set(false);
    } catch {
      this.stale.set(true);
    }
    this.schedule();
  }

  private stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
