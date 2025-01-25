import { Inject, Injectable, Logger, Param } from '@nestjs/common';
import { Request, Response } from 'express';
import * as server from 'http-proxy';
import { ProxyModuleOptions } from '../interfaces';
import { HTTP_PROXY, PROXY_MODULE_OPTIONS } from '../proxy.constants';
import { concatPath, getBaseURL } from '../utils';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    @Inject(HTTP_PROXY) private proxyServer: server,
    @Inject(PROXY_MODULE_OPTIONS) private proxyOptions: ProxyModuleOptions,
  ) {}

  async proxyRequest(
    request: Request<
      unknown,
      unknown,
      unknown,
      { target: string; target_type: string; serviceId: string },
      Record<string, any>
    >,
    response: Response,
    @Param() parameters?: Record<string, string>,
  ) {
    const targetEndpoint = request.query.target;
    const targetType = request.query.target_type;
    let serviceIdentifier = request.query.serviceId.trim();
    let accessToken = null;

    if ('user' in request) {
      accessToken = (request as any).user.authTokens.accessToken;
    }

    const prefix = parameters ? `${parameters[0]}` : '';

    if (targetEndpoint && !serviceIdentifier) {
      const errorMessage = `Cannot make a proxy call without a serviceId`;
      this.logWarning(errorMessage);
      return response.status(500).send({ error: errorMessage });
    }

    const requestHeaders = request.headers as Record<string, string>;

    if (serviceIdentifier) {
      const servicesMap = this.createServicesMap();
      const isSandbox = this.checkIfSandbox(serviceIdentifier);
      if (isSandbox) {
        serviceIdentifier = 'sandbox_epic';
      }

      if (servicesMap.has(serviceIdentifier) || isSandbox) {
        const service = servicesMap.get(serviceIdentifier)!;
        this.logger.debug(
          `Proxying ${request.method} ${request.url} to ${serviceIdentifier}`,
        );
        const urlToProxy = this.getUrlToProxy(service, targetType);

        return this.doProxy(
          request,
          response,
          targetEndpoint
            ? concatPath(urlToProxy, prefix, targetEndpoint)
            : urlToProxy,
          service.forwardToken === false ? null : accessToken,
          { ...service.config, headers: requestHeaders },
        );
      } else {
        const errorMessage = `Could not find serviceId '${serviceIdentifier}'`;
        this.logWarning(errorMessage);
        return response.status(404).send({ error: errorMessage });
      }
    }

    const errorMessage = "Could not find 'target' or 'serviceId'";
    this.logError(errorMessage);
    return response.status(404).send({ error: errorMessage });
  }

  private createServicesMap() {
    return new Map(
      this.proxyOptions.services
        ? this.proxyOptions.services.map((service) => [service.id, service])
        : [],
    );
  }

  private checkIfSandbox(serviceId: string) {
    return (
      serviceId === 'sandbox_epic' ||
      serviceId === '7c3b7890-360d-4a60-9ae1-ca7d10d5b354'
    );
  }

  private getUrlToProxy(service: any, targetType: string) {
    let urlToProxy = service.url;
    if (targetType === 'authorize') {
      urlToProxy = service.authorize;
    } else if (targetType === 'token') {
      urlToProxy = service.token;
    } else if (targetType === 'register') {
      urlToProxy = this.getNormalizedRegisterUrl(service.url);
    }
    return urlToProxy;
  }

  private getNormalizedRegisterUrl(baseUrl: string) {
    return (
      (baseUrl.replace('/api/FHIR/DSTU2/', '') || '').replace(
        'api/FHIR/DSTU2',
        '',
      ) + '/oauth2/register'
    );
  }

  private logWarning(message: string) {
    this.logger.warn({
      error: new Error(message),
      message: message,
      timestamp: new Date().toISOString(),
    });
  }

  private logError(message: string) {
    this.logger.error({
      message: message,
      timestamp: new Date().toISOString(),
      error: new Error(message),
    });
  }

  private async doProxy(
    request: Request<
      unknown,
      unknown,
      unknown,
      { target: string; target_type: string; serviceId: string },
      Record<string, any>
    >,
    response: Response,
    target: string,
    token: string,
    options: server.ServerOptions = {},
  ) {
    const url = new URL(target);
    request.url = `${url.pathname}${url.search}`;

    const defaultOptions = {
      target: getBaseURL(target),
      headers: {
        ...(token && { authorization: 'Bearer ' + token }),
        accept: 'application/json',
      },
    };

    const requestOptions = this.mergeOptions(defaultOptions, options);

    this.proxyServer.web(request, response, requestOptions, (error: any) => {
      if (error.code === 'ECONNRESET') return;

      this.logger.error({
        error: error,
        message: `Error ${error.code} while proxying ${request.method} ${request.url}: ${error.message}`,
        timestamp: new Date().toISOString(),
      });

      response.writeHead(500, {
        'Content-Type': 'text/plain',
      });

      response.end('An error occurred while proxying the request');
    });
  }

  private mergeOptions(defaultOptions: any, options: any) {
    const requestOptions = { ...defaultOptions, ...options };
    requestOptions.headers = {
      ...defaultOptions.headers,
      ...(options && options.headers),
    };
    return requestOptions;
  }
}
