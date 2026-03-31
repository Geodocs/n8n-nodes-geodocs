import { createHmac } from 'crypto';
import { IDataObject } from 'n8n-workflow';
import { GeodocsTrigger } from './GeodocsTrigger.node';

const CREDENTIALS = {
  apiUrl: 'https://api.geodocs.io',
  token: 'gdx_test-token',
};

const SECRET = 'webhook-secret-hex';

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function createStaticData(data: IDataObject = {}): IDataObject {
  return data;
}

function createHookFunctions(overrides: Record<string, any> = {}) {
  const staticData = overrides.staticData ?? createStaticData();
  return {
    getWorkflowStaticData: jest.fn(() => staticData),
    getCredentials: jest.fn().mockResolvedValue({ ...CREDENTIALS, ...overrides.credentials }),
    getNodeParameter: jest.fn((name: string) => {
      if (name === 'events') return overrides.events ?? ['folder.created'];
      return undefined;
    }),
    getNodeWebhookUrl: jest.fn(() => overrides.webhookUrl ?? 'https://n8n.example.com/webhook/abc'),
    getWorkflow: jest.fn(() => ({ name: overrides.workflowName ?? 'Test Workflow' })),
    helpers: {
      httpRequest: overrides.httpRequest ?? jest.fn().mockResolvedValue({
        endpointKey: 'ep-key-123',
        secret: SECRET,
      }),
    },
  };
}

function createWebhookFunctions(overrides: Record<string, any> = {}) {
  const staticData = overrides.staticData ?? createStaticData({ secret: SECRET });
  return {
    getWorkflowStaticData: jest.fn(() => staticData),
    getRequestObject: jest.fn(() => ({
      headers: overrides.headers ?? {},
      body: overrides.body ?? {},
    })),
    helpers: {
      returnJsonArray: jest.fn((data: IDataObject) => [{ json: data }]),
    },
  };
}

describe('GeodocsTrigger', () => {
  let node: GeodocsTrigger;

  beforeEach(() => {
    node = new GeodocsTrigger();
  });

  describe('description', () => {
    it('should have correct metadata', () => {
      expect(node.description.name).toBe('geodocsTrigger');
      expect(node.description.group).toEqual(['trigger']);
      expect(node.description.inputs).toEqual([]);
      expect(node.description.outputs).toEqual(['main']);
    });

    it('should require geodocsApi credentials', () => {
      expect(node.description.credentials).toEqual([
        { name: 'geodocsApi', required: true },
      ]);
    });

    it('should define POST webhook on /webhook path', () => {
      expect(node.description.webhooks).toEqual([
        { name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
      ]);
    });

    it('should list all 13 event types as options', () => {
      const eventsProp = node.description.properties.find((p) => p.name === 'events');
      expect(eventsProp).toBeDefined();
      expect(eventsProp!.type).toBe('multiOptions');
      expect((eventsProp!.options as any[]).length).toBe(13);
    });
  });

  describe('webhookMethods.default.checkExists', () => {
    it('should return true when endpointKey exists in static data', async () => {
      const ctx = createHookFunctions({ staticData: { endpointKey: 'ep-123' } });
      const result = await node.webhookMethods.default.checkExists.call(ctx as any);
      expect(result).toBe(true);
    });

    it('should return false when endpointKey is not in static data', async () => {
      const ctx = createHookFunctions({ staticData: {} });
      const result = await node.webhookMethods.default.checkExists.call(ctx as any);
      expect(result).toBe(false);
    });
  });

  describe('webhookMethods.default.create', () => {
    it('should POST to the webhooks endpoint and store key + secret', async () => {
      const staticData = createStaticData();
      const httpRequest = jest.fn().mockResolvedValue({
        endpointKey: 'ep-key-456',
        secret: 'secret-abc',
      });
      const ctx = createHookFunctions({
        staticData,
        httpRequest,
        events: ['folder.created', 'expense.deleted'],
      });

      const result = await node.webhookMethods.default.create.call(ctx as any);

      expect(result).toBe(true);
      expect(httpRequest).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://api.geodocs.io/api/public/v1/webhooks/endpoints',
        headers: {
          Authorization: 'Bearer gdx_test-token',
          'Content-Type': 'application/json',
        },
        body: {
          url: 'https://n8n.example.com/webhook/abc',
          events: ['folder.created', 'expense.deleted'],
          description: 'n8n workflow: Test Workflow',
        },
        json: true,
      });
      expect(staticData.endpointKey).toBe('ep-key-456');
      expect(staticData.secret).toBe('secret-abc');
    });

    it('should strip trailing slash from apiUrl', async () => {
      const httpRequest = jest.fn().mockResolvedValue({ endpointKey: 'k', secret: 's' });
      const ctx = createHookFunctions({
        credentials: { apiUrl: 'https://api.geodocs.io/' },
        httpRequest,
      });

      await node.webhookMethods.default.create.call(ctx as any);

      const calledUrl = httpRequest.mock.calls[0][0].url;
      expect(calledUrl).toBe('https://api.geodocs.io/api/public/v1/webhooks/endpoints');
    });
  });

  describe('webhookMethods.default.delete', () => {
    it('should DELETE the endpoint and clear static data', async () => {
      const staticData = createStaticData({ endpointKey: 'ep-key-789', secret: SECRET });
      const httpRequest = jest.fn().mockResolvedValue(null);
      const ctx = createHookFunctions({ staticData, httpRequest });

      const result = await node.webhookMethods.default.delete.call(ctx as any);

      expect(result).toBe(true);
      expect(httpRequest).toHaveBeenCalledWith({
        method: 'DELETE',
        url: 'https://api.geodocs.io/api/public/v1/webhooks/endpoints/ep-key-789',
        headers: { Authorization: 'Bearer gdx_test-token' },
      });
      expect(staticData.endpointKey).toBeUndefined();
      expect(staticData.secret).toBeUndefined();
    });

    it('should return true without calling API when no endpointKey', async () => {
      const httpRequest = jest.fn();
      const ctx = createHookFunctions({ staticData: {}, httpRequest });

      const result = await node.webhookMethods.default.delete.call(ctx as any);

      expect(result).toBe(true);
      expect(httpRequest).not.toHaveBeenCalled();
    });

    it('should swallow errors from the DELETE request', async () => {
      const staticData = createStaticData({ endpointKey: 'ep-gone', secret: 's' });
      const httpRequest = jest.fn().mockRejectedValue(new Error('404 Not Found'));
      const ctx = createHookFunctions({ staticData, httpRequest });

      const result = await node.webhookMethods.default.delete.call(ctx as any);

      expect(result).toBe(true);
      expect(staticData.endpointKey).toBeUndefined();
    });
  });

  describe('webhook (signature verification)', () => {
    const payload = {
      id: 'delivery-uuid',
      event: 'folder.created',
      workspaceKey: 'ws-uuid',
      occurredAt: '2026-03-27T14:22:00.000Z',
      data: { id: 'entity-uuid', name: 'Project Alpha', entityType: 'folder' },
    };

    it('should accept a valid signature and return workflow data', async () => {
      const bodyStr = JSON.stringify(payload);
      const signature = sign(bodyStr, SECRET);
      const ctx = createWebhookFunctions({
        headers: { 'x-geodocs-signature': signature },
        body: payload,
      });

      const result = await node.webhook.call(ctx as any);

      expect(result.workflowData).toBeDefined();
      expect(result.workflowData![0]).toEqual([{ json: payload }]);
      expect(result.webhookResponse).toBeUndefined();
    });

    it('should reject when signature header is missing', async () => {
      const ctx = createWebhookFunctions({
        headers: {},
        body: payload,
      });

      const result = await node.webhook.call(ctx as any);

      expect(result.webhookResponse).toBe('Signature missing');
      expect(result.workflowData).toBeUndefined();
    });

    it('should reject when secret is not in static data', async () => {
      const ctx = createWebhookFunctions({
        staticData: {},
        headers: { 'x-geodocs-signature': 'sha256=abc' },
        body: payload,
      });

      const result = await node.webhook.call(ctx as any);

      expect(result.webhookResponse).toBe('Signature missing');
    });

    it('should reject an invalid signature', async () => {
      const ctx = createWebhookFunctions({
        headers: { 'x-geodocs-signature': 'sha256=0000000000000000000000000000000000000000000000000000000000000000' },
        body: payload,
      });

      const result = await node.webhook.call(ctx as any);

      expect(result.webhookResponse).toBe('Invalid signature');
    });

    it('should handle string body correctly', async () => {
      const bodyStr = JSON.stringify(payload);
      const signature = sign(bodyStr, SECRET);
      const ctx = createWebhookFunctions({
        headers: { 'x-geodocs-signature': signature },
        body: bodyStr,
      });

      const result = await node.webhook.call(ctx as any);

      expect(result.workflowData).toBeDefined();
      expect(result.workflowData![0]).toEqual([{ json: payload }]);
    });

    it('should reject when signature has wrong length', async () => {
      const ctx = createWebhookFunctions({
        headers: { 'x-geodocs-signature': 'sha256=tooshort' },
        body: payload,
      });

      const result = await node.webhook.call(ctx as any);

      expect(result.webhookResponse).toBe('Invalid signature');
    });
  });
});
