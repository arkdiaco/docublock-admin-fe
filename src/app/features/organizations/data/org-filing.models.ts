export interface FilingBalance {
  unlimited: boolean;
  remaining: number;
}

export interface PlatformFilingView {
  balance: FilingBalance;
  prefix: string | null;
  example: string | null;
}

export interface FilingPrefixBody {
  prefix: string;
  reason: string;
}
