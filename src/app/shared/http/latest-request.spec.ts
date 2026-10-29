import { LatestRequest } from './latest-request';

describe('LatestRequest', () => {
  it('solo la última petición lanzada sigue vigente', () => {
    const latest = new LatestRequest();
    const primera = latest.start();
    const segunda = latest.start();
    expect(primera()).toBe(false);
    expect(segunda()).toBe(true);
  });
});
