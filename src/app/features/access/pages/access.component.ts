import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { APP_ENV } from '../../../core/config/api.tokens';
import {
  HOME_ROUTE,
  NotPlatformStaffError,
  SessionService,
} from '../../../core/auth/session.service';
import { envLabelKey } from '../../../shared/domain/environment';
import { LogoComponent } from '../../../shared/ui/logo.component';

type Step = 'email' | 'code';

const errorKeyOf = (error: unknown): string => {
  if (error instanceof NotPlatformStaffError) return 'auth.notStaff';
  if (error instanceof HttpErrorResponse) {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'CUENTA_NO_EXISTE') return 'access.err.notFound';
    if (code === 'OTP_RATE_LIMITED' || error.status === 429) return 'access.err.rateLimited';
    if (error.status === 401) return 'access.err.invalidCode';
    if (error.status === 0) return 'access.err.network';
  }
  return 'access.err.generic';
};

@Component({
  selector: 'dba-access',
  imports: [TranslatePipe, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ac">
      <aside class="ac__brand">
        <span class="ac__iso" aria-hidden="true">
          <dba-logo variant="mark" mark="#7954FD" />
        </span>
        <div class="ac__top">
          <dba-logo mark="#7954FD" text="#ffffff" />
          <span class="ac__tag">{{ 'shell.product' | translate }}</span>
        </div>
        <div class="ac__fill"></div>
        <p class="ac__claim">{{ 'access.signed.title' | translate }}</p>
        <p class="ac__lead">{{ 'access.signed.lead' | translate }}</p>
        <div class="ac__env">
          <span class="ac__envDot"></span>
          {{ envLabel | translate }}
        </div>
      </aside>

      <main class="ac__panel">
        <form class="ac__form" (submit)="submit($event)">
          <p class="dba-eyebrow">{{ (step() === 'email' ? 'access.step1' : 'access.step2') | translate }}</p>
          <h1 class="ac__title">{{ (step() === 'email' ? 'access.identify' : 'access.check') | translate }}</h1>

          @if (step() === 'email') {
            <label class="ac__label" for="ac-email">{{ 'access.emailLabel' | translate }}</label>
            <div class="ac__field" [class.ac__field--bad]="!!error()">
              <input
                #emailInput
                id="ac-email"
                class="ac__input"
                type="email"
                name="email"
                autocomplete="username"
                inputmode="email"
                [placeholder]="'access.emailPlaceholder' | translate"
                [value]="email()"
                (input)="onEmail($event)"
              />
            </div>
          } @else {
            <p class="ac__sent">{{ 'access.sentTo' | translate: { channel: channel() } }}</p>
            <label class="ac__label" for="ac-code">{{ 'access.codeLabel' | translate }}</label>
            <div class="ac__field ac__field--mono" [class.ac__field--bad]="!!error()">
              <input
                #codeInput
                id="ac-code"
                class="ac__input ac__input--mono"
                type="text"
                name="code"
                autocomplete="one-time-code"
                inputmode="numeric"
                maxlength="6"
                placeholder="------"
                [value]="code()"
                (input)="onCode($event)"
              />
            </div>
          }

          @if (error(); as key) {
            <p class="ac__error" role="alert">{{ key | translate }}</p>
          }

          <button type="submit" class="ac__cta" [disabled]="!canSubmit()">
            @if (busy()) {
              <span class="ac__spinner" aria-hidden="true"></span>
            }
            {{ (step() === 'email' ? 'access.sendCode' : 'access.enter') | translate }}
          </button>

          @if (step() === 'code') {
            <div class="ac__aux">
              <button type="button" class="ac__link" (click)="backToEmail()">{{ 'access.changeEmail' | translate }}</button>
              <button type="button" class="ac__link" [disabled]="cooldown() > 0 || busy()" (click)="resend()">
                @if (cooldown() > 0) {
                  {{ 'access.resendIn' | translate: { seconds: cooldown() } }}
                } @else {
                  {{ 'access.resend' | translate }}
                }
              </button>
            </div>
          }
        </form>
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--dba-surface);
    }

    .ac {
      display: grid;
      grid-template-columns: 480px minmax(0, 1fr);
      min-height: 100vh;
    }

    .ac__brand {
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 40px;
      background: var(--dba-ink);
      overflow: hidden;
    }

    .ac__iso {
      position: absolute;
      left: -120px;
      bottom: -140px;
      width: 560px;
      height: 580px;
      opacity: 0.9;
      line-height: 0;
    }

    .ac__top {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ac__top dba-logo {
      width: 130px;
    }

    .ac__tag {
      padding: 3px 8px;
      border-radius: var(--dba-radius-key);
      background: var(--dba-violet-500);
      font-size: var(--dba-text-eyebrow);
      font-weight: 700;
      letter-spacing: var(--dba-tracking-tag);
      color: var(--dba-surface);
    }

    .ac__fill {
      flex: 1;
    }

    .ac__claim {
      position: relative;
      margin: 0;
      max-width: 14ch;
      font-family: var(--dba-font-display);
      font-size: 30px;
      font-weight: 600;
      line-height: 1.15;
      letter-spacing: var(--dba-tracking-display);
      color: var(--dba-surface);
    }

    .ac__lead {
      position: relative;
      margin: 14px 0 0;
      max-width: 34ch;
      font-size: var(--dba-text-field);
      line-height: 1.6;
      color: var(--dba-text-on-dark);
    }

    .ac__env {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 28px;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      letter-spacing: var(--dba-tracking-th);
      color: var(--dba-text-on-dark);
    }

    .ac__envDot {
      width: 8px;
      height: 8px;
      border-radius: var(--dba-radius-pill);
      background: var(--dba-state-active-dot);
    }

    .ac__panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }

    .ac__form {
      width: 100%;
      max-width: 380px;
    }

    .ac__title {
      margin: 0 0 24px;
      font-family: var(--dba-font-display);
      font-size: var(--dba-text-page);
      font-weight: 600;
      letter-spacing: var(--dba-tracking-display);
      color: var(--dba-ink);
    }

    .ac__sent {
      margin: 0 0 18px;
      font-size: var(--dba-text-body);
      line-height: 1.5;
      color: var(--dba-text-muted);
    }

    .ac__label {
      display: block;
      margin-bottom: 6px;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    .ac__field {
      display: flex;
      align-items: center;
      height: var(--dba-height-field-access);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }

    .ac__field:focus-within {
      border: 1.5px solid var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .ac__field--bad {
      border-color: var(--dba-state-suspended-dot);
    }

    .ac__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-field);
      color: var(--dba-ink);
    }

    .ac__input:focus {
      outline: none;
    }

    .ac__input::placeholder {
      color: var(--dba-text-faint);
    }

    .ac__input--mono {
      font-family: var(--dba-font-mono);
      letter-spacing: 0.4em;
    }

    .ac__error {
      margin: 10px 0 0;
      font-size: var(--dba-text-small);
      line-height: 1.4;
      color: var(--dba-state-suspended-fg);
    }

    .ac__cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      height: var(--dba-height-cta-access);
      margin-top: 18px;
      border: 0;
      border-radius: var(--dba-radius-control);
      background: var(--dba-violet-500);
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-field);
      font-weight: 600;
      color: var(--dba-surface);
      cursor: pointer;
      transition: background 0.15s;
    }

    .ac__cta:hover:not(:disabled) {
      background: var(--dba-violet-600);
    }

    .ac__cta:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .ac__spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: var(--dba-surface);
      border-radius: var(--dba-radius-pill);
      animation: ac-spin 0.7s linear infinite;
    }

    @keyframes ac-spin {
      to {
        transform: rotate(360deg);
      }
    }

    .ac__aux {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 16px;
    }

    .ac__link {
      padding: 0;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-violet-700);
      cursor: pointer;
    }

    .ac__link:disabled {
      color: var(--dba-text-faint);
      cursor: default;
    }

    @media (max-width: 860px) {
      .ac {
        grid-template-columns: 1fr;
      }

      .ac__brand {
        min-height: 240px;
      }
    }

    @media (max-width: 480px) {
      .ac__brand {
        padding: 28px 20px;
        min-height: 200px;
      }

      .ac__panel {
        padding: 28px 20px;
      }

      .ac__claim {
        font-size: 26px;
      }
    }
  `,
})
export class AccessComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly env = inject(APP_ENV);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly step = signal<Step>('email');
  protected readonly email = signal('');
  protected readonly code = signal('');
  protected readonly channel = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly cooldown = signal(0);
  protected readonly envLabel = envLabelKey(this.env.name);

  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly canSubmit = computed(() => {
    if (this.busy()) return false;
    return this.step() === 'email'
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim())
      : this.code().trim().length === 6;
  });

  constructor() {
    effect(() => {
      const target = this.step() === 'email' ? this.emailInput() : this.codeInput();
      if (target) queueMicrotask(() => target.nativeElement.focus());
    });
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  protected onEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.error.set('');
  }

  protected onCode(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value.replace(/\D/g, ''));
    this.error.set('');
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;
    void (this.step() === 'email' ? this.sendCode() : this.enter());
  }

  protected backToEmail(): void {
    this.stopTimer();
    this.step.set('email');
    this.code.set('');
    this.error.set('');
  }

  protected async resend(): Promise<void> {
    if (this.cooldown() > 0 || this.busy()) return;
    await this.ask(true);
  }

  private async sendCode(): Promise<void> {
    const sent = await this.ask(false);
    if (sent) this.step.set('code');
  }

  private async ask(resend: boolean): Promise<boolean> {
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.session.requestCode(this.email().trim(), resend);
      this.channel.set(result.channel ?? this.email().trim());
      this.startCooldown(result.resendAfterSeconds ?? 60);
      return true;
    } catch (error) {
      this.error.set(errorKeyOf(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private async enter(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.session.loginWithCode(this.email().trim(), this.code().trim());
      await this.router.navigateByUrl(this.redirectTarget());
    } catch (error) {
      this.error.set(errorKeyOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  private redirectTarget(): string {
    const raw = new URLSearchParams(window.location.search).get('redirect');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : HOME_ROUTE;
  }

  private startCooldown(seconds: number): void {
    this.stopTimer();
    this.cooldown.set(Math.max(0, Math.round(seconds)));
    if (this.cooldown() === 0) return;
    this.timer = setInterval(() => {
      this.cooldown.update((value) => Math.max(0, value - 1));
      if (this.cooldown() === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
