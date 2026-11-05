export type SettingValue = number | number[] | string | string[];
export type SettingKind = 'integer' | 'integer_list' | 'text' | 'text_list';
export type SettingGroup = 'alerts' | 'access' | 'signing' | 'validation' | 'texts';
export type SettingUnit =
  | 'percent'
  | 'days'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'attempts'
  | 'perHour'
  | 'reminders'
  | 'rows'
  | 'megabytes'
  | 'text'
  | 'lines';
export type SettingCharset = 'name' | 'line';
export type SettingChangeAction = 'change' | 'reset' | 'restore';

export interface SettingRange {
  min: number;
  max: number;
}

export interface SettingItem {
  key: string;
  group: string;
  kind: SettingKind;
  unit: SettingUnit;
  value: SettingValue;
  defaultValue: SettingValue;
  isDefault: boolean;
  technical: SettingRange;
  recommended: SettingRange;
  maxItems: number | null;
  charset: SettingCharset | null;
  version: number;
  lastChange: { at: string; adminName: string | null; reason: string } | null;
}

export interface SettingChange {
  id: string;
  key: string;
  version: number;
  action: SettingChangeAction;
  from: SettingValue;
  fromDefault: boolean;
  to: SettingValue;
  toDefault: boolean;
  adminName: string | null;
  reason: string;
  at: string;
}

export interface SettingsHistoryPage {
  total: number;
  page: number;
  limit: number;
  items: SettingChange[];
}

export interface SettingsHistoryQuery {
  key?: string | null;
  page: number;
  limit: number;
}

export interface SettingAction {
  reason: string;
  expectedVersion: number;
}

export type CredentialState = 'configured' | 'partial' | 'missing';

export interface CredentialItem {
  variable: string;
  kind: string;
  required: boolean;
  configured: boolean;
}

export interface CredentialGroup {
  key: string;
  state: CredentialState;
  items: CredentialItem[];
}
