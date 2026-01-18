import {
  Controller,
  Get,
  Post,
  Body,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { HealowService } from './healow.service';
import { ConfigService } from '../config/config.service';

interface TokenExchangeRequest {
  code: string;
  redirect_uri: string;
  code_verifier: string;
  tenant_id: string;
}

interface TokenRefreshRequest {
  refresh_token: string;
  tenant_id: string;
}

/**
 * Healow API endpoints for tenant search and confidential client OAuth.
 *
 * The /token and /refresh endpoints are used only in CONFIDENTIAL CLIENT MODE
 * when HEALOW_CLIENT_SECRET is configured. They inject the client_secret
 * server-side before forwarding requests to Healow's OAuth endpoints.
 *
 * In PUBLIC CLIENT MODE, the frontend uses the proxy endpoint instead.
 */
@Controller('v1/healow')
export class HealowController {
  constructor(
    private readonly healowService: HealowService,
    private readonly configService: ConfigService,
  ) {}

  @Get('tenants')
  async getTenants(@Res() response: Response, @Query('query') query: string) {
    try {
      const data = await this.healowService.queryR4Tenants(query);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('r4/tenants')
  async getR4Tenants(@Res() response: Response, @Query('query') query: string) {
    try {
      const data = await this.healowService.queryR4Tenants(query);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Post('token')
  async exchangeToken(
    @Res() response: Response,
    @Body() body: TokenExchangeRequest,
  ) {
    const clientId = this.configService.getPublicConfig().HEALOW_CLIENT_ID;
    const clientSecret = this.configService.getHealowClientSecret();

    if (!clientId || !clientSecret) {
      response.status(400).send({
        error: 'server_configuration_error',
        error_description: 'Healow confidential client not configured',
      });
      return;
    }

    const tenant = this.healowService.findTenantById(body.tenant_id);
    if (!tenant) {
      response.status(400).send({
        error: 'invalid_tenant',
        error_description: 'Unknown Healow tenant ID',
      });
      return;
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: body.code,
        redirect_uri: body.redirect_uri,
        code_verifier: body.code_verifier,
      });

      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64',
      );

      Logger.log(`Healow token exchange to ${tenant.token}`);
      Logger.log({
        redirect_uri: body.redirect_uri,
        tenant_id: body.tenant_id,
      });

      const tokenResponse = await fetch(tenant.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: params.toString(),
      });

      const data = await tokenResponse.json();

      if (!tokenResponse.ok) {
        Logger.error('Healow token exchange failed', {
          status: tokenResponse.status,
          data,
          token_url: tenant.token,
        });
        response.status(tokenResponse.status).send(data);
        return;
      }

      response.json(data);
    } catch (e) {
      Logger.error('Healow token exchange error:', e);
      response.status(500).send({
        error: 'token_exchange_error',
        error_description: 'Failed to exchange token with Healow',
      });
    }
  }

  @Post('refresh')
  async refreshToken(
    @Res() response: Response,
    @Body() body: TokenRefreshRequest,
  ) {
    const clientId = this.configService.getPublicConfig().HEALOW_CLIENT_ID;
    const clientSecret = this.configService.getHealowClientSecret();

    if (!clientId || !clientSecret) {
      response.status(400).send({
        error: 'server_configuration_error',
        error_description: 'Healow confidential client not configured',
      });
      return;
    }

    const tenant = this.healowService.findTenantById(body.tenant_id);
    if (!tenant) {
      response.status(400).send({
        error: 'invalid_tenant',
        error_description: 'Unknown Healow tenant ID',
      });
      return;
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: body.refresh_token,
      });

      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64',
      );

      const tokenResponse = await fetch(tenant.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: params.toString(),
      });

      const data = await tokenResponse.json();

      if (!tokenResponse.ok) {
        Logger.error('Healow token refresh failed', {
          status: tokenResponse.status,
          data,
        });
        response.status(tokenResponse.status).send(data);
        return;
      }

      response.json(data);
    } catch (e) {
      Logger.error('Healow token refresh error:', e);
      response.status(500).send({
        error: 'token_refresh_error',
        error_description: 'Failed to refresh token with Healow',
      });
    }
  }
}
