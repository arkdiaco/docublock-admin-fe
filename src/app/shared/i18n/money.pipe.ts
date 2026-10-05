import { Pipe, PipeTransform } from '@angular/core';
import { formatCount, formatPesos } from '../domain/money';

@Pipe({ name: 'pesos' })
export class PesosPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatPesos(value ?? 0);
  }
}

@Pipe({ name: 'count' })
export class CountPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatCount(value ?? 0);
  }
}
