import { GeodocsApi } from './GeodocsApi.credentials';

describe('GeodocsApi Credentials', () => {
  const cred = new GeodocsApi();

  it('should have correct name and display name', () => {
    expect(cred.name).toBe('geodocsApi');
    expect(cred.displayName).toBe('Geodocs API');
  });

  it('should define apiUrl property with correct default', () => {
    const apiUrl = cred.properties.find((p) => p.name === 'apiUrl');
    expect(apiUrl).toBeDefined();
    expect(apiUrl!.type).toBe('string');
    expect(apiUrl!.default).toBe('https://api.geodocs.io');
  });

  it('should define token property as password', () => {
    const token = cred.properties.find((p) => p.name === 'token');
    expect(token).toBeDefined();
    expect(token!.type).toBe('string');
    expect((token!.typeOptions as any).password).toBe(true);
    expect(token!.default).toBe('');
  });
});
