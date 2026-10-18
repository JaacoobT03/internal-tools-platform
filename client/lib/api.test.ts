import { apiUrl } from './api';

describe('apiUrl', () => {
  it('joins a path onto the API base URL', () => {
    expect(apiUrl('/health', 'http://localhost:3001')).toBe(
      'http://localhost:3001/health',
    );
  });

  it.each(['http://host/api', 'http://host/api/'])(
    'keeps the path prefix of base URL %s',
    (base) => {
      expect(apiUrl('/health', base)).toBe('http://host/api/health');
      expect(apiUrl('health?x=1', base)).toBe('http://host/api/health?x=1');
    },
  );
});
