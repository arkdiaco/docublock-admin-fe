import { errorCodeOf } from '../../../shared/http/error-code';

const KNOWN = new Set([
  'STAFF_YA_EXISTE',
  'STAFF_NO_EXISTE',
  'STAFF_PROPIO',
  'ULTIMO_SUPERADMIN',
  'MOTIVO_REQUERIDO',
]);

export const staffErrorKey = (error: unknown): string => {
  const code = errorCodeOf(error);
  return code && KNOWN.has(code) ? `staff.error.${code}` : 'staff.error.generic';
};
