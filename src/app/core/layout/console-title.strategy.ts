import { Injectable, Injector, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

export const BRAND_TITLE = 'Docublock Admin';

export const titleKeysOf = (root: ActivatedRouteSnapshot): string[] => {
  const keys: string[] = [];
  let route: ActivatedRouteSnapshot | null = root;
  while (route) {
    const key = route.data['titleKey'] as string | undefined;
    if (key && keys[keys.length - 1] !== key) keys.push(key);
    route = route.firstChild;
  }
  return keys;
};

@Injectable({ providedIn: 'root' })
export class ConsoleTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly injector = inject(Injector);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = titleKeysOf(snapshot.root).at(-1);
    const page = key ? (this.injector.get(TranslateService).instant(key) as string) : '';
    this.title.setTitle(page && page !== key ? `${page} · ${BRAND_TITLE}` : BRAND_TITLE);
  }
}
