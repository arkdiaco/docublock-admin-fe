export type SettingValue = number | number[];
export type SettingKind = 'integer' | 'integer_list';
export type SettingGroup = 'alerts' | 'access';
export type SettingUnit =
  'percent' | 'days' | 'hours' | 'minutes' | 'seconds' | 'attempts' | 'perHour';
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
