import { textLength } from '../../../shared/domain/text-length';

export const REASON_MIN = 3;

export const reasonReady = (text: string): boolean => textLength(text.trim()) >= REASON_MIN;
