import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

export const ORG_PARAM = 'organizacion';
const VIEW_PARAM = 'vista';
const MONGO_ID = /^[a-f\d]{24}$/i;

export class FilterUrl {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  organization(): string | null {
    const value = this.route.snapshot.queryParamMap.get(ORG_PARAM);
    return value && MONGO_ID.test(value) ? value : null;
  }

  view(allowed: readonly string[]): string | null {
    const value = this.route.snapshot.queryParamMap.get(VIEW_PARAM);
    return value && allowed.includes(value) ? value : null;
  }

  write(organizationId: string | null, view: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [ORG_PARAM]: organizationId, [VIEW_PARAM]: view || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
