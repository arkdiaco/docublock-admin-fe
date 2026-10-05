import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';

const MARK =
  'M119.31,29.62V4.47c0-3.05-3.3-4.95-5.94-3.43L33.5,47.15c-2.04,1.18-3.3,3.36-3.3,5.72v60.97c0,2.36-1.26,4.54-3.3,5.72l-23.1,13.34c-2.04,1.18-3.3,3.36-3.3,5.72v28.2c0,1.41.75,2.72,1.98,3.43l24.42,14.1c2.04,1.18,4.56,1.18,6.6,0l23.1-13.34c2.04-1.18,4.56-1.18,6.6,0l23.1,13.34c2.04,1.18,4.56,1.18,6.6,0l82.5-47.63c2.04-1.18,3.3-3.36,3.3-5.72v-60.97c0-2.36-1.26-4.54-3.3-5.72l-54.12-31.25c-1.23-.71-1.98-2.01-1.98-3.43ZM119.31,130.98c0,2.36-1.26,4.54-3.3,5.72l-52.8,30.49c-2.04,1.18-4.56,1.18-6.6,0l-24.42-14.1c-1.23-.71-1.98-2.01-1.98-3.43v-28.2c0-2.36,1.26-4.54,3.3-5.72l52.8-30.49c2.04-1.18,3.3-3.36,3.3-5.72v-30.49l23.76-13.72c2.64-1.52,5.94.38,5.94,3.43v92.22Z';

const MESSAGE_MS = 1270;
const COMPACT_PX = 20;

export type LoaderVariant = 'mark' | 'page';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'db-loader',
  template: `
    <div class="ld" role="status" [class.ld--page]="variant() === 'page'" [class.ld--compact]="compact()" [style.--ld-size]="variant() === 'page' ? '118px' : size()">
      @if (variant() === 'page') {
        <span class="ld__glow" aria-hidden="true"></span>
      }
      <span class="ld__mark" aria-hidden="true">
        @if (variant() === 'page') {
          <span class="ld__seal"></span>
        }
        <svg class="ld__ghost" viewBox="0 0 179.21 185.72"><path [attr.d]="mark" /></svg>
        <span class="ld__rise">
          <svg class="ld__ink" viewBox="0 0 179.21 185.72"><path [attr.d]="mark" /></svg>
        </span>
      </span>

      @if (variant() === 'page') {
        <img class="ld__word" src="/assets/images/logo/logo-docublock-color.svg" alt="Docublock" />
        <span class="ld__bar" aria-hidden="true"><span class="ld__run"></span></span>
        <span class="ld__messages">
          @for (message of [current()]; track message) {
            <span class="ld__message">{{ message }}</span>
          }
        </span>
        @if (footnote()) {
          <span class="ld__foot">
            <span class="ld__dot" aria-hidden="true"></span>
            <span>{{ footnote() }}</span>
          </span>
        }
      } @else if (label()) {
        <span class="ld__label">{{ label() }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      vertical-align: middle;
    }

    :host-context(button),
    :host-context(a),
    :host-context(label) {
      --ld-ink: currentColor;
    }

    .ld {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .ld__mark {
      position: relative;
      display: block;
      width: var(--ld-size, 48px);
      aspect-ratio: 179.21 / 185.72;
      animation: ld-breathe 3.8s ease-in-out infinite;
    }

    .ld__ghost,
    .ld__ink {
      position: absolute;
      left: 0;
      bottom: 0;
      width: var(--ld-size, 48px);
      aspect-ratio: 179.21 / 185.72;
      fill: currentColor;
    }

    .ld__ghost {
      color: var(--ld-ink, var(--db-primary));
      opacity: 0.2;
    }

    .ld__ink {
      color: var(--ld-ink, var(--db-primary));
    }

    .ld__rise {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      overflow: hidden;
      animation: ld-rise 3.8s cubic-bezier(0.45, 0.05, 0.35, 1) infinite;
    }

    .ld--compact .ld__mark {
      animation: none;
    }

    .ld--compact .ld__rise {
      animation-duration: 1.2s;
    }

    .ld--compact .ld__ghost {
      opacity: 0.3;
    }

    .ld__label {
      font-size: 12.5px;
      font-weight: 500;
      color: var(--db-ink-300);
    }

    .ld--page {
      position: fixed;
      inset: 0;
      z-index: 1000;
      justify-content: center;
      gap: 0;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }

    .ld__glow {
      position: absolute;
      top: -20%;
      left: 50%;
      width: 860px;
      height: 860px;
      border-radius: 50%;
      background: radial-gradient(circle at center, rgba(121, 85, 253, 0.1), rgba(121, 85, 253, 0) 66%);
      transform: translateX(-50%);
      pointer-events: none;
    }

    .ld__seal {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 210px;
      height: 210px;
      margin: -105px 0 0 -105px;
      border-radius: 50%;
      background: radial-gradient(circle at center, rgba(121, 85, 253, 0.32), rgba(121, 85, 253, 0) 62%);
      animation: ld-seal 3.8s ease-out infinite;
      pointer-events: none;
    }

    .ld__word {
      position: relative;
      height: 19px;
      margin-top: 30px;
      opacity: 0.92;
    }

    .ld__bar {
      position: relative;
      width: 172px;
      height: 3px;
      margin-top: 26px;
      overflow: hidden;
      border-radius: 2px;
      background: #f0eef6;
    }

    .ld__run {
      display: block;
      width: 34%;
      height: 100%;
      border-radius: 2px;
      background: var(--db-primary);
      animation: ld-bar 1.5s cubic-bezier(0.65, 0.05, 0.35, 0.95) infinite;
    }

    .ld__messages {
      position: relative;
      width: 320px;
      max-width: 80vw;
      height: 17px;
      margin-top: 20px;
    }

    .ld__message {
      position: absolute;
      inset: 0;
      font-size: 12.5px;
      text-align: center;
      color: #6b6780;
      animation: ld-message 0.3s ease-out;
    }

    .ld__foot {
      position: absolute;
      right: 0;
      bottom: 30px;
      left: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font: 500 10px ui-monospace, Menlo, monospace;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #6f6a80;
    }

    .ld__dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #0e8a5f;
      animation: ld-dot 1.8s ease-in-out infinite;
    }

    @keyframes ld-rise {
      0% {
        height: 0%;
        opacity: 1;
      }
      62%,
      84% {
        height: 100%;
        opacity: 1;
      }
      100% {
        height: 100%;
        opacity: 0;
      }
    }

    @keyframes ld-seal {
      0%,
      58% {
        opacity: 0;
        transform: scale(0.9);
      }
      68% {
        opacity: 0.55;
        transform: scale(1.14);
      }
      82%,
      100% {
        opacity: 0;
        transform: scale(1.3);
      }
    }

    @keyframes ld-breathe {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.035);
      }
    }

    @keyframes ld-bar {
      0% {
        transform: translateX(-110%);
      }
      100% {
        transform: translateX(360%);
      }
    }

    @keyframes ld-message {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes ld-dot {
      0%,
      100% {
        opacity: 0.25;
      }
      50% {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .ld__mark,
      .ld__seal,
      .ld__dot {
        animation: none;
      }
    }
  `,
})
export class LoaderComponent {
  readonly size = input('48px');
  protected readonly compact = computed(() => this.variant() !== 'page' && Number.parseFloat(this.size()) <= COMPACT_PX);
  readonly label = input('');
  readonly variant = input<LoaderVariant>('mark');
  readonly messages = input<readonly string[]>([]);
  readonly footnote = input('');

  protected readonly mark = MARK;
  private readonly step = signal(0);
  protected readonly current = computed(() => {
    const messages = this.messages().length > 0 ? this.messages() : [this.label()];
    return messages[this.step() % messages.length] ?? '';
  });

  constructor() {
    let timer: ReturnType<typeof setInterval> | undefined;
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    effect(() => {
      clearInterval(timer);
      if (this.variant() !== 'page' || this.messages().length < 2) return;
      timer = setInterval(() => this.step.update((step) => step + 1), MESSAGE_MS);
    });
  }
}
