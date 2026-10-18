import { apiUrl } from './api';

describe('apiUrl', () => {
  it('joins a path onto the API base URL', () => {
    expect(apiUrl('/health', 'http://localhost:3001')).toBe(
      'http://localhost:3001/health',
    );
  });
});
