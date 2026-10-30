import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TextAreaComponent } from './text-area.component';

describe('TextAreaComponent', () => {
  it('cuenta los caracteres, escribe el valor y muestra el error', () => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
    const fixture = TestBed.createComponent(TextAreaComponent);
    fixture.componentRef.setInput('label', 'mkt.f.summary');
    fixture.componentRef.setInput('maxlength', 600);
    fixture.componentRef.setInput('value', 'Hola');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.area__count')?.textContent).toBe('4 / 600');
    const area = host.querySelector<HTMLTextAreaElement>('textarea')!;
    area.value = 'Hola mundo';
    area.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.value()).toBe('Hola mundo');
    fixture.componentRef.setInput('error', 'common.required');
    fixture.detectChanges();
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('.area__note--error')?.textContent?.trim()).toBe('common.required');
  });
});
