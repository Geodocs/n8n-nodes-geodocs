import { IDataObject } from 'n8n-workflow';
import { GeodocsSearch } from './GeodocsSearch.node';

const CREDENTIALS = {
  apiUrl: 'https://api.geodocs.io',
  token: 'gdx_test-token',
};

function createExecuteFunctions(overrides: Record<string, any> = {}) {
  const params = overrides.params ?? {};
  return {
    getInputData: jest.fn(() => overrides.inputData ?? [{ json: {} }]),
    getCredentials: jest.fn().mockResolvedValue({ ...CREDENTIALS, ...overrides.credentials }),
    getNodeParameter: jest.fn((name: string, _index: number) => {
      return params[name];
    }),
    helpers: {
      httpRequest: overrides.httpRequest ?? jest.fn().mockResolvedValue([]),
    },
  };
}

describe('GeodocsSearch', () => {
  let node: GeodocsSearch;

  beforeEach(() => {
    node = new GeodocsSearch();
  });

  describe('description', () => {
    it('should have correct metadata', () => {
      expect(node.description.name).toBe('geodocsFetch');
      expect(node.description.group).toEqual(['transform']);
      expect(node.description.inputs).toEqual(['main']);
      expect(node.description.outputs).toEqual(['main']);
    });

    it('should require geodocsApi credentials', () => {
      expect(node.description.credentials).toEqual([
        { name: 'geodocsApi', required: true },
      ]);
    });

    it('should define 4 resource types', () => {
      const resource = node.description.properties.find((p) => p.name === 'resource');
      expect((resource!.options as any[]).map((o: any) => o.value)).toEqual([
        'folders', 'assignments', 'expenses', 'budgets',
      ]);
    });

    it('should define search and get operations', () => {
      const operation = node.description.properties.find((p) => p.name === 'operation');
      expect((operation!.options as any[]).map((o: any) => o.value)).toEqual(['search', 'get']);
    });
  });

  describe('execute — search operation', () => {
    it('should call GET with search term and return array results', async () => {
      const mockResults = [
        { id: 'f1', name: 'Folder A' },
        { id: 'f2', name: 'Folder B' },
      ];
      const httpRequest = jest.fn().mockResolvedValue(mockResults);
      const ctx = createExecuteFunctions({
        params: { resource: 'folders', operation: 'search', term: 'alpha' },
        httpRequest,
      });

      const result = await node.execute.call(ctx as any);

      expect(httpRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://api.geodocs.io/api/public/v1/folders?term=alpha',
        headers: { Authorization: 'Bearer gdx_test-token' },
        json: true,
      });
      expect(result).toEqual([[
        { json: { id: 'f1', name: 'Folder A' } },
        { json: { id: 'f2', name: 'Folder B' } },
      ]]);
    });

    it('should URL-encode the search term', async () => {
      const httpRequest = jest.fn().mockResolvedValue([]);
      const ctx = createExecuteFunctions({
        params: { resource: 'assignments', operation: 'search', term: 'hello world & more' },
        httpRequest,
      });

      await node.execute.call(ctx as any);

      const calledUrl = httpRequest.mock.calls[0][0].url;
      expect(calledUrl).toBe(
        'https://api.geodocs.io/api/public/v1/assignments?term=hello%20world%20%26%20more',
      );
    });

    it('should return empty array when no results', async () => {
      const httpRequest = jest.fn().mockResolvedValue([]);
      const ctx = createExecuteFunctions({
        params: { resource: 'expenses', operation: 'search', term: 'nonexistent' },
        httpRequest,
      });

      const result = await node.execute.call(ctx as any);

      expect(result).toEqual([[]]);
    });
  });

  describe('execute — get operation', () => {
    it('should call GET with resource key and return single result', async () => {
      const mockResult = { id: 'budget-uuid', name: 'Q1 Budget', amount: 5000 };
      const httpRequest = jest.fn().mockResolvedValue(mockResult);
      const ctx = createExecuteFunctions({
        params: { resource: 'budgets', operation: 'get', key: 'budget-uuid' },
        httpRequest,
      });

      const result = await node.execute.call(ctx as any);

      expect(httpRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://api.geodocs.io/api/public/v1/budgets/budget-uuid',
        headers: { Authorization: 'Bearer gdx_test-token' },
        json: true,
      });
      expect(result).toEqual([[{ json: mockResult }]]);
    });
  });

  describe('execute — multiple items', () => {
    it('should process each input item independently', async () => {
      const httpRequest = jest.fn()
        .mockResolvedValueOnce({ id: 'f1', name: 'Folder 1' })
        .mockResolvedValueOnce([{ id: 'e1', name: 'Expense 1' }, { id: 'e2', name: 'Expense 2' }]);

      const params: Record<string, string[]> = {
        resource: ['folders', 'expenses'],
        operation: ['get', 'search'],
        key: ['folder-key', ''],
        term: ['', 'test'],
      };

      const ctx = createExecuteFunctions({
        inputData: [{ json: {} }, { json: {} }],
        params,
        httpRequest,
      });
      // Override getNodeParameter to use index
      ctx.getNodeParameter = jest.fn((name: string, index: number) => {
        return (params[name] as string[])[index];
      });

      const result = await node.execute.call(ctx as any);

      expect(httpRequest).toHaveBeenCalledTimes(2);
      expect(result).toEqual([[
        { json: { id: 'f1', name: 'Folder 1' } },
        { json: { id: 'e1', name: 'Expense 1' } },
        { json: { id: 'e2', name: 'Expense 2' } },
      ]]);
    });
  });

  describe('execute — API URL handling', () => {
    it('should strip trailing slash from apiUrl', async () => {
      const httpRequest = jest.fn().mockResolvedValue([]);
      const ctx = createExecuteFunctions({
        credentials: { apiUrl: 'https://api.geodocs.io/' },
        params: { resource: 'folders', operation: 'search', term: 'x' },
        httpRequest,
      });

      await node.execute.call(ctx as any);

      const calledUrl = httpRequest.mock.calls[0][0].url;
      expect(calledUrl).toStartWith('https://api.geodocs.io/api/');
    });
  });

  describe('execute — all resource types', () => {
    it.each(['folders', 'assignments', 'expenses', 'budgets'])(
      'should build correct URL for %s',
      async (resource) => {
        const httpRequest = jest.fn().mockResolvedValue([]);
        const ctx = createExecuteFunctions({
          params: { resource, operation: 'search', term: 'test' },
          httpRequest,
        });

        await node.execute.call(ctx as any);

        expect(httpRequest.mock.calls[0][0].url).toBe(
          `https://api.geodocs.io/api/public/v1/${resource}?term=test`,
        );
      },
    );
  });
});

// Custom matcher
expect.extend({
  toStartWith(received: string, prefix: string) {
    const pass = received.startsWith(prefix);
    return {
      pass,
      message: () => `expected "${received}" to start with "${prefix}"`,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toStartWith(prefix: string): R;
    }
  }
}
