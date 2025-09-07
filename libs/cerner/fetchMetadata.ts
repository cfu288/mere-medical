import * as fs from 'fs';
import 'dotenv/config';

class TerminalColor {
  static readonly BgBlue = '\x1b[44m';
  static readonly Green = '\x1b[32m';
  static readonly Red = '\x1b[31m';
  static readonly Reset = '\x1b[0m';

  static bgBlue = (str: string) =>
    `${TerminalColor.BgBlue}${str}${TerminalColor.Reset}`;
  static green = (str: string) =>
    `${TerminalColor.Green}${str}${TerminalColor.Reset}`;
  static red = (str: string) =>
    `${TerminalColor.Red}${str}${TerminalColor.Reset}`;
}

interface CernerEndpointResource {
  resourceType: string;
  id: string;
  contained?: Array<{
    resourceType: string;
    id: string;
    name: string;
    address?: Array<{
      line?: string[];
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    }>;
  }>;
  status: string;
  managingOrganization?: {
    id: string;
  };
  address: string;
}

interface CernerEndpointBundle {
  resourceType: string;
  id: string;
  type: string;
  total: number;
  entry: Array<{
    resource: CernerEndpointResource;
  }>;
}

interface ProcessedEndpoint {
  id: string;
  name: string;
  url: string;
  token?: string;
  authorize?: string;
  introspect?: string;
  manage?: string;
  managingOrganization?: string;
}

(async () => {
  try {
    console.log('Starting DSTU2 Endpoint Metadata Fetcher for Cerner');
    
    const endpointsUrl = process.env.DSTU2_ENDPOINTS_URL ;
    if (!endpointsUrl) {
      throw new Error('DSTU2_ENDPOINTS_URL is not defined in environment variables');
    }    
    console.log(`Using URL: ${endpointsUrl}`);

    // Fetch the list of Cerner endpoints (from GitHub raw JSON)
    const response = await fetch(endpointsUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch endpoints: ${response.status} ${response.statusText}`);
    }

    const data: CernerEndpointBundle = await response.json();

    // Extract endpoint information from the bundle
    const endpoints: ProcessedEndpoint[] = data?.entry?.map((entry) => {
      const resource = entry.resource;
      const organization = resource.contained?.[0];
      
      return {
        id: resource.id,
        name: organization?.name || 'Unknown',
        url: resource.address,
        managingOrganization: resource.managingOrganization?.id,
      };
    }) || [];

    if (!endpoints.length) {
      throw new Error('No endpoints found in the response');
    }

    console.log(`Found ${endpoints.length} endpoints to process`);

    // Fetch metadata for each endpoint
    const fetchMetadata = async (endpoint: ProcessedEndpoint): Promise<ProcessedEndpoint> => {
      const metadataUrl = `${endpoint.url}metadata`;
      
      try {
        const metaResponse = await fetch(metadataUrl, {
          headers: {
            Accept: 'application/json+fhir',
          },
        });

        if (!metaResponse.ok) {
          throw new Error(`HTTP ${metaResponse.status}`);
        }

        const metadata = await metaResponse.json();
        
        // Extract OAuth URLs from the metadata
        const securityExtensions = metadata?.rest?.[0]?.security?.extension?.[0]?.extension;
        
        if (securityExtensions) {
          const findExtension = (urlType: string) => 
            securityExtensions.find((ext: any) => ext.url === urlType)?.valueUri;
          
          endpoint.token = findExtension('token');
          endpoint.authorize = findExtension('authorize');
          endpoint.introspect = findExtension('introspect');
          endpoint.manage = findExtension('manage');
        }
        
        console.log(`✓ ${metadataUrl}`);
        return endpoint;
      } catch (error) {
        console.log(`✗ ${metadataUrl} - ${error}`);
        throw error;
      }
    };

    // Process endpoints in batches
    const batchSize = 10;
    const results: ProcessedEndpoint[] = [];
    const errors: any[] = [];

    for (let i = 0; i < endpoints.length; i += batchSize) {
      const batch = endpoints.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`\nProcessing batch ${TerminalColor.bgBlue(`${batchNumber}`)} (${batch.length} endpoints)`);
      
      const metadataPromises = batch.map(fetchMetadata);
      const batchResults = await Promise.allSettled(metadataPromises);
      
      const successful = batchResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<ProcessedEndpoint>).value);
      
      const failed = batchResults
        .filter((result) => result.status === 'rejected')
        .map((result, index) => ({
          endpoint: batch[index],
          error: (result as PromiseRejectedResult).reason,
        }));
      
      results.push(...successful);
      errors.push(...failed);
      
      console.log(
        `Batch ${TerminalColor.bgBlue(`${batchNumber}`)}: ` +
        `${TerminalColor.green(`${successful.length} successful`)}, ` +
        `${TerminalColor.red(`${failed.length} failed`)}`
      );
    }

    // Add Cerner sandbox endpoint
    results.push({
      id: 'sandbox_cerner',
      name: 'Cerner Sandbox',
      url: 'https://fhir-myrecord.cerner.com/dstu2/ec2458f2-1e24-41c8-b71b-0e701af7583d/',
      token: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token',
      authorize: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    });

    // Save results to file
    const outputPath = './src/lib/data/DSTU2Endpoints.json';
    
    // Ensure the data directory exists
    const dataDir = './src/lib/data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`\n${TerminalColor.green('✓ Success!')}`);
    console.log(`Saved ${results.length} endpoints to ${outputPath}`);
    
    // Save error log if there were any errors
    if (errors.length > 0) {
      const errorLogPath = './errorlog.json';
      fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2));
      console.log(
        TerminalColor.red(
          `${errors.length} error(s) occurred. Details saved to ${errorLogPath}`
        )
      );
    }
    
  } catch (error) {
    console.error(TerminalColor.red('Fatal error:'), error);
    process.exit(1);
  }
})().catch((error) => {
  console.error(TerminalColor.red('Unhandled error:'), error);
  process.exit(1);
});