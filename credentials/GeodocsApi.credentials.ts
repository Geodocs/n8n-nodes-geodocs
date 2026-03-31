import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class GeodocsApi implements ICredentialType {
  name = 'geodocsApi';
  displayName = 'Geodocs API';
  documentationUrl = 'https://geodocs.io/api-docs';
  properties: INodeProperties[] = [
    {
      displayName: 'API URL',
      name: 'apiUrl',
      type: 'string',
      default: 'https://api.geodocs.io',
      placeholder: 'https://api.geodocs.io',
      description: 'The base URL for Geodocs API',
    },
    {
      displayName: 'Personal Access Token',
      name: 'token',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'PAT starting with gdx_ — create one in Geodocs > Settings > API Tokens',
    },
  ];
}
