import { deviceLabel } from './device-label';

describe('deviceLabel', () => {
  it('resume el navegador y el sistema del user agent', () => {
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36')).toBe(
      'Chrome · macOS',
    );
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1')).toBe('Safari · iOS');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36 Edg/141.0')).toBe('Edge · Windows');
    expect(deviceLabel('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox · Linux');
  });

  it('sin user agent no inventa nada y uno desconocido se muestra tal cual', () => {
    expect(deviceLabel(null)).toBeNull();
    expect(deviceLabel('')).toBeNull();
    expect(deviceLabel('curl/8.4')).toBe('curl/8.4');
  });
});
