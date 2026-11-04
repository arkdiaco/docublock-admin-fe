import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { conPermisos, configurar, ficha, porRegistrar } from '../pages/legal-entities-test-kit';
import {
  changesOf,
  LegalEntityFormComponent,
  type LegalEntityFormResult,
} from './legal-entity-form.component';

const sinCambios = () => ({
  businessName: 'Acme SAS',
  identification: '900111222',
  countryId: 'co',
  kindPersonId: 'jur',
});

describe('Entidades jurídicas › Formulario', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
    conPermisos(['platform:clients:manage']);
  });

  afterEach(() => http.verify());

  it('sin cambios no manda nada', () => {
    expect(changesOf(ficha(), sinCambios())).toEqual({});
  });

  it('manda solo lo cambiado, recortado', () => {
    expect(changesOf(ficha(), { ...sinCambios(), businessName: ' Nueva ' })).toEqual({
      businessName: 'Nueva',
    });
  });

  it('quitar país y tipo manda null', () => {
    expect(changesOf(ficha(), { ...sinCambios(), countryId: null, kindPersonId: null })).toEqual({
      countryId: null,
      kindPersonId: null,
    });
  });

  it('desde un firmante llega lleno y propone al representante legal', async () => {
    const fixture = TestBed.createComponent(LegalEntityFormComponent);
    fixture.componentRef.setInput('draft', porRegistrar());
    const resultados: LegalEntityFormResult[] = [];
    fixture.componentInstance.submitted.subscribe((value) => resultados.push(value));
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
    http.expectOne('/catalogs/countries/co/kind-persons').flush([
      { id: 'jur', name: 'Persona Juridica', type: 'legal' },
      { id: 'nat', name: 'Persona Natural', type: 'natural' },
    ]);
    await fixture.whenStable();

    const componente = fixture.componentInstance as unknown as {
      reason: { set(value: string): void };
      submit(): void;
      kinds(): { id: string }[];
    };
    expect(componente.kinds().map((kind) => kind.id)).toEqual(['jur']);
    componente.reason.set('Registro');
    componente.submit();
    expect(resultados).toEqual([
      {
        kind: 'create',
        reason: 'Registro',
        data: {
          businessName: 'Gravitar SAS',
          identification: '900370406',
          countryId: 'co',
          kindPersonId: 'jur',
          representative: { signerId: 'p1', isLegalRep: true },
        },
      },
    ]);
  });

  it('un tipo de persona natural del firmante no se arrastra', async () => {
    const fixture = TestBed.createComponent(LegalEntityFormComponent);
    fixture.componentRef.setInput(
      'draft',
      porRegistrar({ kindPersonId: 'nat', representative: undefined }),
    );
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([]);
    http.expectOne('/catalogs/countries/co/kind-persons').flush([
      { id: 'jur', name: 'Persona Juridica', type: 'legal' },
      { id: 'nat', name: 'Persona Natural', type: 'natural' },
    ]);
    await vi.waitFor(() => {
      const componente = fixture.componentInstance as unknown as {
        kindPersonId(): string | null;
      };
      expect(componente.kindPersonId()).toBeNull();
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('1032409749');
  });
});
