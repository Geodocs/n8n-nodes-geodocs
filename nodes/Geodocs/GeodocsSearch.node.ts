import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class GeodocsSearch implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Geodocs Fetch',
    name: 'geodocsFetch',
    icon: 'file:geodocs.png',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Search and lookup Geodocs resources',
    defaults: {
      name: 'Geodocs Fetch',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'geodocsApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Folder', value: 'folders' },
          { name: 'Assignment', value: 'assignments' },
          { name: 'Expense', value: 'expenses' },
          { name: 'Budget', value: 'budgets' },
        ],
        default: 'folders',
        description: 'The resource type to operate on',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Search',
            value: 'search',
            description: 'Search resources by term',
            action: 'Search resources by term',
          },
          {
            name: 'Get',
            value: 'get',
            description: 'Get a resource by key',
            action: 'Get a resource by key',
          },
        ],
        default: 'search',
      },
      {
        displayName: 'Search Term',
        name: 'term',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['search'],
          },
        },
        description: 'The search term to filter results',
      },
      {
        displayName: 'Resource Key',
        name: 'key',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['get'],
          },
        },
        description: 'The UUID key of the resource to retrieve',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('geodocsApi');
    const apiUrl = (credentials.apiUrl as string).replace(/\/$/, '');
    const token = credentials.token as string;

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;

      let url: string;
      if (operation === 'get') {
        const key = this.getNodeParameter('key', i) as string;
        url = `${apiUrl}/api/public/v1/${resource}/${key}`;
      } else {
        const term = this.getNodeParameter('term', i) as string;
        url = `${apiUrl}/api/public/v1/${resource}?term=${encodeURIComponent(term)}`;
      }

      const response = await this.helpers.httpRequest({
        method: 'GET',
        url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        json: true,
      });

      if (Array.isArray(response)) {
        for (const item of response) {
          returnData.push({ json: item as IDataObject });
        }
      } else {
        returnData.push({ json: response as IDataObject });
      }
    }

    return [returnData];
  }
}
