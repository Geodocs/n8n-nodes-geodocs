import { createHmac, timingSafeEqual } from 'crypto';
import {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';

function verifySignature(secret: string, rawBody: string, signatureHeader: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signatureHeader.replace('sha256=', '');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export class GeodocsTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Geodocs Trigger',
    name: 'geodocsTrigger',
    icon: 'file:geodocs.png',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description: 'Starts the workflow when Geodocs events occur',
    defaults: {
      name: 'Geodocs Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'geodocsApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        required: true,
        default: [],
        options: [
          { name: 'Folder Created', value: 'folder.created' },
          { name: 'Folder Updated', value: 'folder.updated' },
          { name: 'Folder Deleted', value: 'folder.deleted' },
          { name: 'Folder Archived', value: 'folder.archived' },
          { name: 'Assignment Created', value: 'assignment.created' },
          { name: 'Assignment Updated', value: 'assignment.updated' },
          { name: 'Assignment Deleted', value: 'assignment.deleted' },
          { name: 'Expense Created', value: 'expense.created' },
          { name: 'Expense Updated', value: 'expense.updated' },
          { name: 'Expense Deleted', value: 'expense.deleted' },
          { name: 'Budget Created', value: 'budget.created' },
          { name: 'Budget Updated', value: 'budget.updated' },
          { name: 'Budget Deleted', value: 'budget.deleted' },
        ],
        description: 'The events to listen for',
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData('node');
        return !!staticData.endpointKey;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const credentials = await this.getCredentials('geodocsApi');
        const apiUrl = (credentials.apiUrl as string).replace(/\/$/, '');
        const token = credentials.token as string;
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const events = this.getNodeParameter('events') as string[];

        const response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${apiUrl}/api/public/v1/webhooks/endpoints`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: {
            url: webhookUrl,
            events,
            description: `n8n workflow: ${this.getWorkflow().name}`,
          },
          json: true,
        });

        const staticData = this.getWorkflowStaticData('node');
        staticData.endpointKey = (response as IDataObject).endpointKey;
        staticData.secret = (response as IDataObject).secret;
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData('node');
        const endpointKey = staticData.endpointKey as string;
        if (!endpointKey) return true;

        const credentials = await this.getCredentials('geodocsApi');
        const apiUrl = (credentials.apiUrl as string).replace(/\/$/, '');
        const token = credentials.token as string;

        try {
          await this.helpers.httpRequest({
            method: 'DELETE',
            url: `${apiUrl}/api/public/v1/webhooks/endpoints/${endpointKey}`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch {
          // Endpoint may already be deleted — ignore
        }

        delete staticData.endpointKey;
        delete staticData.secret;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const staticData = this.getWorkflowStaticData('node');
    const secret = staticData.secret as string;
    const req = this.getRequestObject();

    const signatureHeader = req.headers['x-geodocs-signature'] as string | undefined;
    if (!signatureHeader || !secret) {
      return { webhookResponse: 'Signature missing', workflowData: undefined as any };
    }

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verifySignature(secret, rawBody, signatureHeader)) {
      return { webhookResponse: 'Invalid signature', workflowData: undefined as any };
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    return {
      workflowData: [this.helpers.returnJsonArray(body as IDataObject)],
    };
  }
}
