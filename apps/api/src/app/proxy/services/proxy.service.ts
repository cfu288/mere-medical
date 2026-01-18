import { Inject, Injectable, Logger, Param } from '@nestjs/common';
import { Request, Response } from 'express';
import * as server from 'http-proxy';
import { ProxyModuleOptions, Service } from '../interfaces';
import { HTTP_PROXY, PROXY_MODULE_OPTIONS } from '../proxy.constants';
import { concatPath, getBaseURL } from '../utils';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    @Inject(HTTP_PROXY) private proxy: server,
    @Inject(PROXY_MODULE_OPTIONS) private options: ProxyModuleOptions,
  ) {}

  // TODO: Convert endpoints arrays to Map<id, endpoint> for O(1) lookup instead of O(n) scan
  private findService(
    vendor: string | undefined,
    serviceId: string,
  ):
    | { service: Service; error?: never }
    | { service?: never; error: { status: number; body: object } } {
    if (vendor) {
      const vendorServices = this.options.services?.find(
        (s) => s.vendor === vendor,
      );
      if (!vendorServices) {
        return {
          error: {
            status: 404,
            body: { error: `Vendor '${vendor}' not found` },
          },
        };
      }
      const service = vendorServices.endpoints.find((e) => e.id === serviceId);
      if (!service) {
        return {
          error: {
            status: 404,
            body: { error: `Service '${vendor}/${serviceId}' not found` },
          },
        };
      }
      return { service };
    }

    const matches = (this.options.services || []).flatMap((v) =>
      v.endpoints
        .filter((e) => e.id === serviceId)
        .map((e) => ({ vendor: v.vendor, ...e })),
    );

    if (matches.length === 0) {
      return {
        error: {
          status: 404,
          body: { error: `Service '${serviceId}' not found` },
        },
      };
    }

    if (matches.length > 1) {
      return {
        error: {
          status: 400,
          body: {
            error: `Ambiguous serviceId '${serviceId}' matches multiple vendors. Provide 'vendor' param.`,
            matches: matches.map((m) => m.vendor),
          },
        },
      };
    }

    return { service: matches[0] };
  }

  async proxyRequest(
    req: Request,
    res: Response,
    @Param() params?: Record<string, string>,
  ) {
    const target = req.query.target as string;
    const target_type = req.query.target_type as string;
    const serviceId = (req.query.serviceId as string | undefined)?.trim();
    const vendor = req.query.vendor as string | undefined;
    let token = null;

    // eslint-disable-next-line no-prototype-builtins
    if (req.hasOwnProperty('user')) {
      token = ((req as any).user as any).authTokens.accessToken;
    }

    const prefix = params ? `${params[0]}` : '';

    if (target && !serviceId) {
      const error = `Cannot make a proxy call without a serviceId`;
      this.logger.warn({
        error: new Error(`Cannot make a proxy call without a serviceId`),
        message: error,
        timestamp: new Date().toISOString(),
      });
      return res.status(500).send({
        error,
      });
    }

    const headers = req.headers as { [header: string]: string };

    if (serviceId) {
      const result = this.findService(vendor, serviceId);

      if (result.error) {
        this.logger.warn({
          message: JSON.stringify(result.error.body),
          error: new Error(JSON.stringify(result.error.body)),
          timestamp: new Date().toISOString(),
        });
        return res.status(result.error.status).send(result.error.body);
      }

      const service = result.service;
      this.logger.debug(
        `Proxying ${req.method} ${req.url} to ${vendor ? `${vendor}/` : ''}${serviceId}`,
      );
      const baseUrl = service.url;
      const authUrl = service.authorize;
      const tokenUrl = service.token;
      let urlToProxy = baseUrl;

      if (target_type === 'authorize') {
        urlToProxy = authUrl;
      } else if (target_type === 'token') {
        urlToProxy = tokenUrl;
      } else if (target_type === 'register') {
        urlToProxy =
          baseUrl
            .replace('/api/FHIR/DSTU2/', '')
            .replace('/api/FHIR/DSTU2', '')
            .replace('/api/FHIR/R4/', '')
            .replace('/api/FHIR/R4', '') + '/oauth2/register';
      }

      return this.doProxy(
        req,
        res,
        target ? concatPath(urlToProxy, prefix, target) : urlToProxy,
        service.forwardToken === false ? null : token,
        { ...service.config, headers },
      );
    }

    res.status(404).send({ error: "Could not find 'target' or 'serviceId'" });
    this.logger.error({
      message: "Could not find 'target' or 'serviceId'",
      timestamp: new Date().toISOString(),
      error: new Error("Could not find 'target' or 'serviceId'"),
    });
  }

  private async doProxy(
    req: Request,
    res: Response,
    target: string,
    token: string,
    options: server.ServerOptions = {},
  ) {
    const url = new URL(target);
    req.url = `${url.pathname}${url.search}`;

    const defaultOptions = {
      target: getBaseURL(target),
      headers: {
        ...(token && { authorization: 'Bearer ' + token }),
        accept: 'application/json',
      },
    };

    // Allow http-server options overriding
    const requestOptions = { ...defaultOptions, ...options };
    requestOptions.headers = {
      ...defaultOptions.headers,
      ...(options && options.headers),
    }; // To deep extend headers

    this.proxy.web(req, res, requestOptions, (err: any) => {
      if (err.code === 'ECONNRESET') return;

      this.logger.error({
        error: err,
        message: `Error ${err.code} while proxying ${req.method} ${req.url}: ${err.message}`,
        timestamp: new Date().toISOString(),
      });

      res.writeHead(500, {
        'Content-Type': 'text/plain',
      });

      res.end('An error occurred while proxying the request');
    });
  }
}
