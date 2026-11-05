import { inject } from '@angular/core';
import type { Route, Routes } from '@angular/router';
import { authGuard, guestGuard, platformMatchGuard } from './core/auth/auth.guards';
import { AuthStore } from './core/auth/auth.store';
import { HOME_ROUTE } from './core/auth/session.service';
import { ConsoleShellComponent } from './core/layout/console-shell.component';
import {
  CONSOLE_GROUPS,
  LEGACY_REDIRECTS,
  MY_ACCESS_PATH,
  OVERVIEW_PATH,
  canSeeItem,
  groupAccess,
  itemAccess,
  type ConsoleGroup,
  type ConsoleItem,
  type ConsoleSection,
} from './core/layout/console-nav';

const placeholder = () =>
  import('./features/placeholder/pages/placeholder.component').then((m) => m.PlaceholderComponent);

const SECTION_PAGES: Partial<Record<ConsoleSection, Routes>> = {
  organizations: [
    {
      path: '',
      loadComponent: () =>
        import('./features/organizations/pages/organizations.component').then(
          (m) => m.OrganizationsComponent,
        ),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/organizations/pages/organization-detail.component').then(
          (m) => m.OrganizationDetailComponent,
        ),
    },
  ],
  users: [
    {
      path: '',
      loadComponent: () =>
        import('./features/users/pages/users.component').then((m) => m.UsersComponent),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/users/pages/user-detail.component').then((m) => m.UserDetailComponent),
    },
  ],
  signers: [
    {
      path: '',
      loadComponent: () =>
        import('./features/signers/pages/signers.component').then((m) => m.SignersComponent),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/signers/pages/signer-detail.component').then(
          (m) => m.SignerDetailComponent,
        ),
    },
  ],
  legalEntities: [
    {
      path: '',
      loadComponent: () =>
        import('./features/legal-entities/pages/legal-entities.component').then(
          (m) => m.LegalEntitiesComponent,
        ),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/legal-entities/pages/legal-entity-detail.component').then(
          (m) => m.LegalEntityDetailComponent,
        ),
    },
  ],
  documents: [
    {
      path: '',
      loadComponent: () =>
        import('./features/documents/pages/documents.component').then((m) => m.DocumentsComponent),
    },
    {
      path: 'regenerar',
      loadComponent: () =>
        import('./features/documents/pages/document-regenerate.component').then(
          (m) => m.DocumentRegenerateComponent,
        ),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/documents/pages/document-detail.component').then(
          (m) => m.DocumentDetailComponent,
        ),
    },
  ],
  countries: [
    {
      path: '',
      loadComponent: () =>
        import('./features/catalogs/pages/countries.component').then((m) => m.CountriesComponent),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/catalogs/pages/country-detail.component').then(
          (m) => m.CountryDetailComponent,
        ),
    },
  ],
  cities: [
    {
      path: '',
      loadComponent: () =>
        import('./features/catalogs/pages/cities.component').then((m) => m.CitiesComponent),
    },
  ],
  kindPersons: [
    {
      path: '',
      loadComponent: () =>
        import('./features/catalogs/pages/kind-persons.component').then(
          (m) => m.KindPersonsComponent,
        ),
    },
  ],
  identificationTypes: [
    {
      path: '',
      loadComponent: () =>
        import('./features/catalogs/pages/identification-types.component').then(
          (m) => m.IdentificationTypesComponent,
        ),
    },
  ],
  signerFields: [
    {
      path: '',
      loadComponent: () =>
        import('./features/catalogs/pages/signer-fields.component').then(
          (m) => m.SignerFieldsComponent,
        ),
    },
  ],
  propertyCatalog: [
    {
      path: '',
      loadComponent: () =>
        import('./features/catalogs/pages/property-catalog.component').then(
          (m) => m.PropertyCatalogComponent,
        ),
    },
  ],
  policies: [
    {
      path: '',
      loadComponent: () =>
        import('./features/catalogs/pages/consent-policies.component').then(
          (m) => m.ConsentPoliciesComponent,
        ),
    },
  ],
  communications: [
    {
      path: '',
      loadComponent: () =>
        import('./features/communications/pages/communications.component').then(
          (m) => m.CommunicationsComponent,
        ),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/communications/pages/campaign-detail.component').then(
          (m) => m.CampaignDetailComponent,
        ),
    },
  ],
  support: [
    {
      path: '',
      loadComponent: () =>
        import('./features/support/pages/tickets.component').then((m) => m.TicketsComponent),
    },
    {
      path: 'politicas',
      loadComponent: () =>
        import('./features/support/pages/sla-policies.component').then(
          (m) => m.SlaPoliciesComponent,
        ),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/support/pages/ticket-detail.component').then(
          (m) => m.TicketDetailComponent,
        ),
    },
  ],
  billing: [
    {
      path: '',
      loadComponent: () =>
        import('./features/billing/pages/transactions.component').then(
          (m) => m.TransactionsComponent,
        ),
    },
    {
      path: 'facturas',
      loadComponent: () =>
        import('./features/billing/pages/invoices.component').then((m) => m.InvoicesComponent),
    },
    {
      path: 'facturas/:id',
      loadComponent: () =>
        import('./features/billing/pages/invoice-detail.component').then(
          (m) => m.InvoiceDetailComponent,
        ),
    },
    {
      path: 'ingresos',
      loadComponent: () =>
        import('./features/billing/pages/revenue.component').then((m) => m.RevenueComponent),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/billing/pages/transaction-detail.component').then(
          (m) => m.TransactionDetailComponent,
        ),
    },
  ],
  plans: [
    {
      path: '',
      loadComponent: () =>
        import('./features/plans/pages/plans.component').then((m) => m.PlansComponent),
    },
    {
      path: ':code',
      loadComponent: () =>
        import('./features/plans/pages/plan-detail.component').then((m) => m.PlanDetailComponent),
    },
  ],
  subscriptions: [
    {
      path: '',
      loadComponent: () =>
        import('./features/subscriptions/pages/subscriptions.component').then(
          (m) => m.SubscriptionsComponent,
        ),
    },
  ],
  marketplace: [
    {
      path: '',
      loadComponent: () =>
        import('./features/marketplace/pages/marketplace.component').then(
          (m) => m.MarketplaceComponent,
        ),
    },
    {
      path: ':code',
      loadComponent: () =>
        import('./features/marketplace/pages/product-detail.component').then(
          (m) => m.ProductDetailComponent,
        ),
    },
  ],
  promotions: [
    {
      path: '',
      loadComponent: () =>
        import('./features/promotions/pages/promotions.component').then(
          (m) => m.PromotionsComponent,
        ),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/promotions/pages/promotion-detail.component').then(
          (m) => m.PromotionDetailComponent,
        ),
    },
  ],
  referrals: [
    {
      path: '',
      loadComponent: () =>
        import('./features/promotions/pages/referrals.component').then((m) => m.ReferralsComponent),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/promotions/pages/referral-detail.component').then(
          (m) => m.ReferralDetailComponent,
        ),
    },
  ],
  resellers: [
    {
      path: '',
      loadComponent: () =>
        import('./features/resellers/pages/resellers.component').then((m) => m.ResellersComponent),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./features/resellers/pages/reseller-detail.component').then(
          (m) => m.ResellerDetailComponent,
        ),
    },
  ],
  integrations: [
    {
      path: '',
      loadComponent: () =>
        import('./features/integrations/pages/deliveries.component').then(
          (m) => m.DeliveriesComponent,
        ),
    },
    {
      path: 'claves',
      loadComponent: () =>
        import('./features/integrations/pages/keys.component').then((m) => m.KeysComponent),
    },
    {
      path: 'destinos',
      loadComponent: () =>
        import('./features/integrations/pages/endpoints.component').then(
          (m) => m.EndpointsComponent,
        ),
    },
  ],
  tasks: [
    {
      path: '',
      loadComponent: () =>
        import('./features/tasks/pages/tasks.component').then((m) => m.TasksComponent),
    },
    {
      path: 'jobs',
      loadComponent: () =>
        import('./features/tasks/pages/jobs.component').then((m) => m.JobsComponent),
    },
    {
      path: 'maintenance',
      loadComponent: () =>
        import('./features/tasks/pages/maintenance.component').then((m) => m.MaintenanceComponent),
    },
    {
      path: ':queue',
      loadComponent: () =>
        import('./features/tasks/pages/queue-detail.component').then((m) => m.QueueDetailComponent),
    },
  ],
  audit: [
    {
      path: '',
      loadComponent: () =>
        import('./features/audit/pages/audit.component').then((m) => m.AuditComponent),
    },
  ],
  settings: [
    {
      path: '',
      data: { group: 'alerts' },
      loadComponent: () =>
        import('./features/settings/pages/settings.component').then((m) => m.SettingsComponent),
    },
    {
      path: 'accesos',
      data: { group: 'access' },
      loadComponent: () =>
        import('./features/settings/pages/settings.component').then((m) => m.SettingsComponent),
    },
    {
      path: 'firma',
      data: { group: 'signing' },
      loadComponent: () =>
        import('./features/settings/pages/settings.component').then((m) => m.SettingsComponent),
    },
    {
      path: 'validacion',
      data: { group: 'validation' },
      loadComponent: () =>
        import('./features/settings/pages/settings.component').then((m) => m.SettingsComponent),
    },
    {
      path: 'historial',
      loadComponent: () =>
        import('./features/settings/pages/settings-history.component').then(
          (m) => m.SettingsHistoryComponent,
        ),
    },
  ],
  staff: [
    {
      path: '',
      loadComponent: () =>
        import('./features/staff/pages/staff.component').then((m) => m.StaffComponent),
    },
  ],
  health: [
    {
      path: '',
      loadComponent: () =>
        import('./features/status/pages/status.component').then((m) => m.StatusComponent),
    },
  ],
};

const sectionRoute = (group: ConsoleGroup, item: ConsoleItem): Route => ({
  path: item.path,
  canMatch: [platformMatchGuard],
  data: { titleKey: item.labelKey, platform: itemAccess(group, item) },
  children: SECTION_PAGES[item.key] ?? [
    { path: '', loadComponent: placeholder, data: { titleKey: item.labelKey } },
  ],
});

const firstVisible = (group: ConsoleGroup) => () => {
  const owned = inject(AuthStore).platformPermissions();
  const item = group.items.find((candidate) => canSeeItem(owned, group, candidate));
  return item ? `/${group.path}/${item.path}` : HOME_ROUTE;
};

const groupRoute = (group: ConsoleGroup): Route => ({
  path: group.path,
  canMatch: [authGuard, platformMatchGuard],
  data: { titleKey: group.labelKey, platform: groupAccess(group.key) },
  children: [
    { path: '', pathMatch: 'full', redirectTo: firstVisible(group) },
    ...group.items.map((item) => sectionRoute(group, item)),
  ],
});

export const routes: Routes = [
  {
    path: 'acceso',
    canMatch: [guestGuard],
    loadComponent: () =>
      import('./features/access/pages/access.component').then((m) => m.AccessComponent),
    data: { titleKey: 'access.title' },
  },
  {
    path: '',
    component: ConsoleShellComponent,
    children: [
      {
        path: OVERVIEW_PATH,
        canMatch: [authGuard],
        loadComponent: () =>
          import('./features/overview/pages/overview.component').then((m) => m.OverviewComponent),
        data: { titleKey: 'nav.overview' },
      },
      ...CONSOLE_GROUPS.map(groupRoute),
      {
        path: MY_ACCESS_PATH,
        canMatch: [authGuard],
        loadComponent: () =>
          import('./features/my-access/pages/my-access.component').then((m) => m.MyAccessComponent),
        data: { titleKey: 'mine.title' },
      },
      {
        path: 'sistema/diseno',
        canMatch: [authGuard],
        loadComponent: () =>
          import('./features/design-system/pages/design-system.component').then(
            (m) => m.DesignSystemComponent,
          ),
        data: { titleKey: 'sys.title' },
      },
      ...LEGACY_REDIRECTS.map(([path, redirectTo]): Route => ({
        path,
        pathMatch: 'full',
        redirectTo,
      })),
      { path: '', pathMatch: 'full', redirectTo: OVERVIEW_PATH },
    ],
  },
  { path: '**', redirectTo: OVERVIEW_PATH },
];
