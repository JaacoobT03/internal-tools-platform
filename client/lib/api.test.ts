import { ApiError, apiGet, apiPost, apiUrl } from './api';

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

describe('apiGet', () => {
  it('sends X-User-Id and returns JSON', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: 1 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(apiGet('/auth/me', 'u-auditor')).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/auth/me',
      expect.objectContaining({ headers: { 'X-User-Id': 'u-auditor' } }),
    );
  });

  it('throws ApiError with the status on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ message: 'Missing permission' }),
    }) as unknown as typeof fetch;
    await expect(apiGet('/audit', 'u-viewer')).rejects.toEqual(
      new ApiError(403, 'Missing permission'),
    );
  });
});

describe('apiPost', () => {
  it('sends X-User-Id and a JSON body and returns JSON', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: 'r1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      apiPost('/things', { amountCents: 100 }, 'u-requester'),
    ).resolves.toEqual({ id: 'r1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/things',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'X-User-Id': 'u-requester',
          'Content-Type': 'application/json',
        },
        body: '{"amountCents":100}',
      }),
    );
  });

  it('sends no body or Content-Type when body is omitted', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await apiPost('/things/1/approve', undefined, 'u-approver');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/things/1/approve',
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-User-Id': 'u-approver' },
        body: undefined,
      }),
    );
  });

  it('throws ApiError with the status on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: () => Promise.resolve({ message: 'Already decided' }),
    }) as unknown as typeof fetch;
    await expect(
      apiPost('/things/1/approve', undefined, 'u-approver'),
    ).rejects.toEqual(new ApiError(409, 'Already decided'));
  });
});
