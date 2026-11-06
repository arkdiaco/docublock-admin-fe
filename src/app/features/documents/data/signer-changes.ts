import type {
  AttachmentChange,
  AttachmentChangeKind,
  EnabledValidations,
  PlatformSigner,
  ReactivationChoice,
  ReactivationScope,
  RegistryCredits,
  RequestedAttachment,
  SignerChange,
  SignerFeature,
} from './documents.models';

export interface Phrase {
  key: string;
  params?: Record<string, string | number>;
}

export type FeatureValues = Record<SignerFeature, boolean>;

export type GatedFeature = keyof Omit<EnabledValidations, 'registryCredits'>;

export const VALIDATION_FEATURES: readonly GatedFeature[] = [
  'identityValid',
  'biometricValid',
  'checkDataRegistry',
];

export const IDENTITY_FEATURES: readonly SignerFeature[] = [
  'fullIdentity',
  'reqDocument',
  'skipEmail',
];

const SIGNER_FEATURES: readonly SignerFeature[] = [...VALIDATION_FEATURES, ...IDENTITY_FEATURES];

const RAISING: ReadonlySet<SignerFeature> = new Set([
  'identityValid',
  'biometricValid',
  'reqDocument',
]);

const isGated = (feature: SignerFeature): feature is GatedFeature =>
  (VALIDATION_FEATURES as readonly SignerFeature[]).includes(feature);

export const featureValuesOf = (signer: PlatformSigner): FeatureValues => ({
  identityValid: signer.requirements.identityValid,
  biometricValid: signer.requirements.biometricValid,
  checkDataRegistry: signer.requirements.checkDataRegistry,
  fullIdentity: signer.requirements.fullIdentity,
  reqDocument: signer.requirements.reqDocument,
  skipEmail: signer.requirements.skipEmail,
});

export const isLocked = (
  feature: SignerFeature,
  before: FeatureValues,
  enabled: EnabledValidations,
): boolean => isGated(feature) && !before[feature] && !enabled[feature];

export const changedFeaturesOf = (
  before: FeatureValues,
  after: FeatureValues,
): Partial<FeatureValues> =>
  Object.fromEntries(
    SIGNER_FEATURES.filter((feature) => before[feature] !== after[feature]).map((feature) => [
      feature,
      after[feature],
    ]),
  );

export const raisesRequirements = (changes: Partial<FeatureValues>): boolean =>
  SIGNER_FEATURES.some((feature) => RAISING.has(feature) && changes[feature] === true);

export const isDelivered = (item: RequestedAttachment): boolean =>
  item.provided && item.file !== undefined;

export const attachmentChangesOf = (
  attachments: readonly RequestedAttachment[],
  marks: ReadonlyMap<number, AttachmentChangeKind>,
): AttachmentChange[] =>
  attachments.flatMap((item) => {
    const change = marks.get(item.index);
    if (!change || isDelivered(item)) return [];
    if (change === 'optional' && !item.required) return [];
    return [{ index: item.index, name: item.name, change }];
  });

export const signerChangeOf = (
  features: Partial<FeatureValues>,
  attachments: readonly AttachmentChange[],
): SignerChange => ({
  ...features,
  ...(attachments.length > 0 ? { attachments: [...attachments] } : {}),
});

export const reactivationChoicesOf = (
  scopes: readonly ReactivationScope[],
): ReactivationChoice[] => (scopes.length > 1 ? [...scopes, 'all'] : [...scopes]);

export const scopesOfChoice = (
  choice: ReactivationChoice,
  scopes: readonly ReactivationScope[],
): ReactivationScope[] => (choice === 'all' ? [...scopes] : scopes.filter((s) => s === choice));

export const registryCostOf = (credits?: RegistryCredits): Phrase => {
  if (!credits) return { key: 'docs.registryCheck.plain' };
  if (credits.unlimited) return { key: 'docs.registryCheck.unlimited' };
  return credits.remaining > 0
    ? { key: 'docs.registryCheck.count', params: { remaining: credits.remaining } }
    : { key: 'docs.registryCheck.none' };
};
