import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export const ONE_SUFFIX = 'One';

@Pipe({ name: 'pluralKey' })
export class PluralKeyPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(key: string, count: number): string {
    if (count !== 1) return key;
    const one = `${key}${ONE_SUFFIX}`;
    return this.translate.instant(one) === one ? key : one;
  }
}
