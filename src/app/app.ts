import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { AppUpdateBarComponent } from './core/app-update/app-update-bar.component';
import { DialogHostComponent } from './core/ui/dialog-host.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'dba-root',
  imports: [RouterOutlet, Toast, DialogHostComponent, AppUpdateBarComponent],
  template: `
    <router-outlet />
    <p-toast position="top-right" />
    <db-dialog-host />
    <db-app-update-bar />
  `,
})
export class App {}
