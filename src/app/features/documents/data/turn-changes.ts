import { DOCUMENT_ERRORS } from './document-errors';
import { awaitingSignatures, inOpenTurn } from './document-view';
import type {
  PlatformDocumentDetail,
  PlatformSigner,
  SignerAccessCut,
  SignerRemovalOutcome,
  TurnNotice,
} from './documents.models';
import type { Phrase } from './signer-changes';

export interface NoticeRequest {
  reason: string;
  notify: boolean;
}

export interface NoticeReport {
  failed: boolean;
  counts: Phrase[];
  problem: Phrase[];
}

type ReminderGroup = 'blocked' | 'noEmail' | 'cap' | 'reachable';

const REMINDER_GROUPS: readonly ReminderGroup[] = ['blocked', 'noEmail', 'cap', 'reachable'];

const INTEGRATION_KINDS: ReadonlySet<string> = new Set(['API', 'BRIDGE']);

export const isIntegration = (doc: PlatformDocumentDetail): boolean =>
  INTEGRATION_KINDS.has(doc.kind);

export const signersOf = (doc: PlatformDocumentDetail, ids: readonly string[]): PlatformSigner[] =>
  [...new Set(ids)].flatMap((id) => {
    const signer = doc.signers.find((s) => s.identityId === id);
    return signer ? [signer] : [];
  });

export const namesOf = (signers: readonly PlatformSigner[]): string =>
  signers.map((s) => s.name).join(', ');

export const pendingNamesAt = (doc: PlatformDocumentDetail, order: number): string =>
  namesOf(
    signersOf(
      doc,
      doc.signers.filter((s) => s.order === order && !s.checked).map((s) => s.identityId),
    ),
  );

export const emptiedOrdersOf = (doc: PlatformDocumentDetail, signer: PlatformSigner): number[] => {
  const others = doc.signers.filter((s) => s.identityId !== signer.identityId).map((s) => s.order);
  if (others.length === 0) return [];
  const low = Math.min(...others);
  const high = Math.max(...others);
  const mine = doc.signers.filter((s) => s.identityId === signer.identityId).map((s) => s.order);
  return [...new Set(mine)]
    .filter((order) => order > low && order < high && !others.includes(order))
    .sort((a, b) => a - b);
};

export const removalSummaryOf = (doc: PlatformDocumentDetail, signer: PlatformSigner): Phrase[] => {
  const effect = signer.removal;
  if (!effect) return [];
  const turn: Phrase = effect.turn
    ? { key: 'docs.remove.turnMoves', params: { from: effect.turn.from, to: effect.turn.to } }
    : effect.nobodyPending
      ? { key: 'docs.remove.nobodyPending' }
      : { key: 'docs.remove.turnStays', params: { order: doc.turn.order } };
  return [turn, { key: 'docs.remove.access' }];
};

const chargedOf = (signer: PlatformSigner): boolean =>
  signer.attempts.credits.biometric ||
  signer.attempts.credits.identity ||
  !!signer.checks.registry?.checkedAt ||
  !!signer.checks.liveness?.at ||
  !!signer.checks.faceCompare?.at ||
  !!signer.checks.faceMatch?.at ||
  signer.checks.providerResponses.length > 0;

const evidenceOf = (signer: PlatformSigner): boolean =>
  signer.files.length > 0 ||
  signer.history.length > 0 ||
  signer.attachments.some((item) => item.provided);

export const removalWarningsOf = (
  doc: PlatformDocumentDetail,
  signer: PlatformSigner,
): Phrase[] => {
  const entries = doc.signers.filter((s) => s.identityId === signer.identityId);
  const warnings: Phrase[] = [];
  if (isIntegration(doc)) warnings.push({ key: 'docs.remove.warn.integration' });
  const merged = [
    ...new Set(
      entries.flatMap((entry) =>
        entry.attachments
          .filter((item) => item.includeInDocument && item.provided)
          .map((item) => item.name),
      ),
    ),
  ];
  if (merged.length > 0)
    warnings.push({ key: 'docs.remove.warn.attachments', params: { names: merged.join(', ') } });
  if (entries.some(chargedOf)) warnings.push({ key: 'docs.remove.warn.charged' });
  if (signer.removal?.formLeftPending) warnings.push({ key: 'docs.remove.warn.form' });
  if (entries.some(evidenceOf)) warnings.push({ key: 'docs.remove.warn.evidence' });
  const gaps = emptiedOrdersOf(doc, signer);
  if (gaps.length > 0)
    warnings.push({ key: 'docs.remove.warn.gap', params: { orders: gaps.join(', ') } });
  return warnings;
};

const deadlinePassed = (doc: PlatformDocumentDetail, now: Date): string | null => {
  const deadline = doc.signing?.deadline;
  return deadline && new Date(deadline).getTime() < now.getTime() ? deadline : null;
};

const reminderGroupOf = (signer: PlatformSigner, max?: number): ReminderGroup => {
  if (signer.blocked) return 'blocked';
  if (signer.requirements.skipEmail || !signer.email) return 'noEmail';
  if (max !== undefined && signer.notices.remindersSent >= max) return 'cap';
  return 'reachable';
};

const reminderPhraseOf = (group: ReminderGroup, names: string, max?: number): Phrase =>
  group === 'reachable'
    ? { key: 'docs.turnNotice.warn.reminders', params: { names } }
    : {
        key: `docs.turnNotice.warn.noReminders.${group}`,
        params: group === 'cap' ? { names, max: max ?? 0 } : { names },
      };

const quietWarningsOf = (
  doc: PlatformDocumentDetail,
  people: readonly PlatformSigner[],
  now: Date,
  stamp: (iso: string) => string,
): Phrase[] => {
  const never = people.filter((s) => !s.notices.notifiedAt);
  const invited = people.filter((s) => !!s.notices.notifiedAt);
  const warnings: Phrase[] =
    never.length > 0
      ? [{ key: 'docs.turnNotice.warn.uninvited', params: { names: namesOf(never) } }]
      : [];
  if (invited.length === 0) return warnings;
  const deadline = deadlinePassed(doc, now);
  if (deadline)
    return [
      ...warnings,
      { key: 'docs.turnNotice.warn.noReminders.deadline', params: { date: stamp(deadline) } },
    ];
  const max = doc.signing?.reminders?.max ?? doc.reminderBaseline?.max;
  for (const group of REMINDER_GROUPS) {
    const members = invited.filter((s) => reminderGroupOf(s, max) === group);
    if (members.length > 0) warnings.push(reminderPhraseOf(group, namesOf(members), max));
  }
  return warnings;
};

export const noticeWarningsOf = (
  doc: PlatformDocumentDetail,
  ids: readonly string[],
  notify: boolean,
  now: Date,
  stamp: (iso: string) => string,
): Phrase[] => {
  const people = signersOf(doc, ids);
  if (people.length === 0) return [];
  if (!notify) return quietWarningsOf(doc, people, now, stamp);
  const warnings: Phrase[] = [];
  const auto = people.filter((s) => s.autoSign);
  if (auto.length > 0)
    warnings.push({ key: 'docs.turnNotice.warn.autoSign', params: { names: namesOf(auto) } });
  const blocked = people.filter((s) => s.blocked);
  if (blocked.length > 0)
    warnings.push({ key: 'docs.turnNotice.warn.blocked', params: { names: namesOf(blocked) } });
  const again = people.filter((s) => !!s.notices.notifiedAt);
  if (again.length > 0)
    warnings.push({ key: 'docs.turnNotice.warn.again', params: { names: namesOf(again) } });
  if (isIntegration(doc)) warnings.push({ key: 'docs.turnNotice.warn.integration' });
  const deadline = deadlinePassed(doc, now);
  if (deadline)
    warnings.push({ key: 'docs.turnNotice.warn.deadline', params: { date: stamp(deadline) } });
  return warnings;
};

export const setWarningsOf = (doc: PlatformDocumentDetail): Phrase[] => {
  if (doc.block) return [{ key: 'docs.revoke.warn.block' }];
  if (doc.flow) return [{ key: 'docs.revoke.warn.flow' }];
  return [];
};

export const revokeWarningsOf = (doc: PlatformDocumentDetail, signer: PlatformSigner): Phrase[] => {
  const warnings = setWarningsOf(doc);
  if (awaitingSignatures(doc) && inOpenTurn(doc, signer) && signer.notices.notifiedAt)
    warnings.push({ key: 'docs.revoke.warn.reminder' });
  return warnings;
};

export const accessPhraseOf = (access: SignerAccessCut, documents = 1): Phrase => {
  if (access.links + access.sessions + access.handoffs === 0) return { key: 'docs.revoke.none' };
  const params = { ...access, documents };
  return documents > 1
    ? { key: 'docs.revoke.doneSet', params }
    : { key: 'docs.revoke.done', params };
};

export const removalDoneOf = (name: string, outcome: SignerRemovalOutcome): Phrase => {
  if (outcome.turn) return { key: 'docs.remove.doneTurn', params: { name, to: outcome.turn.to } };
  if (outcome.nobodyPending) return { key: 'docs.remove.doneNobody', params: { name } };
  return { key: 'docs.remove.done', params: { name } };
};

const NOTICE_CAUSES: Readonly<Record<string, string>> = {
  VALIDACIONES_AGOTADAS: 'docs.turnNotice.noCredits',
};

const causeOf = (code?: string): string => {
  if (!code) return 'docs.turnNotice.later';
  return (
    NOTICE_CAUSES[code] ??
    (DOCUMENT_ERRORS.includes(code) ? `docs.error.${code}` : 'docs.turnNotice.later')
  );
};

const countsOf = (notice: TurnNotice): Phrase[] => {
  if (notice.invited === 0) return [];
  const counts: Phrase[] = [
    {
      key: 'docs.turnNotice.sent',
      params: { invited: notice.invited, mailed: notice.mailed, whatsapp: notice.whatsapp },
    },
  ];
  if (notice.autoSigned > 0)
    counts.push({ key: 'docs.turnNotice.autoSigned', params: { count: notice.autoSigned } });
  return counts;
};

export const noticeReportOf = (notice: TurnNotice): NoticeReport => {
  const counts = countsOf(notice);
  if (notice.error)
    return {
      failed: true,
      counts,
      problem: [
        { key: counts.length > 0 ? 'docs.turnNotice.partial' : 'docs.turnNotice.failed' },
        { key: causeOf(notice.error.code) },
      ],
    };
  if (counts.length === 0)
    return { failed: false, counts: [{ key: 'docs.turnNotice.none' }], problem: [] };
  return { failed: false, counts, problem: [] };
};
