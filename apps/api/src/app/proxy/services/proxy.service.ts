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
    @Inject(HTTP_PROXY) private proxy: server | any,
    @Inject(PROXY_MODULE_OPTIONS) private options: ProxyModuleOptions
  ) {}

  async proxyRequest(req: Request, res: Response, @Param() params?) {
    const target = req.query.target as string;
    const target_type = req.query.target_type as string;
    let serviceId = (req.query.serviceId as string).trim();
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
      const services = new Map(
        this.options.services
          ? this.options.services.map((service) => [service.id, service])
          : []
      );
      // Temp workaround for sandbox
      const isSandbox =
        serviceId === 'sandbox' ||
        serviceId === '7c3b7890-360d-4a60-9ae1-ca7d10d5b354';
      if (isSandbox) {
        serviceId = 'sandbox';
      }

      if (services.has(serviceId) || isSandbox) {
        const service = services.get(serviceId);
        this.logger.debug(`Proxying ${req.method} ${req.url} to ${serviceId}`);
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
            (baseUrl.replace('/api/FHIR/DSTU2/', '') || '').replace(
              'api/FHIR/DSTU2',
              ''
            ) + '/oauth2/register';
        }

        return this.doProxy(
          req,
          res,
          target ? concatPath(urlToProxy, prefix, target) : urlToProxy,
          service.forwardToken === false ? null : token,
          { ...service.config, headers }
        );
      } else {
        const error = `Could not find serviceId '${serviceId}'`;
        this.logger.warn({
          message: error,
          error: new Error(`Could not find serviceId '${serviceId}'`),
          timestamp: new Date().toISOString(),
        });
        return res.status(404).send({
          error,
        });
      }
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
    options: server.ServerOptions = {}
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

    this.proxy.web(req, res, requestOptions, (err) => {
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
