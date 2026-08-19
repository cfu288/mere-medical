import { Controller, Inject, Post, Body, Logger, Res } from '@nestjs/common';
import { Response } from 'express';
import { NEXTGEN_CONSTANTS } from '@mere/fhir-oauth';
import { NextGenModuleConfig } from './nextgen.config';

interface TokenExchangeRequest {
  code: string;
  redirect_uri: string;
}

interface TokenRefreshRequest {
  refresh_token: string;
}

/**
 * NextGen confidential client OAuth endpoints. NextGen issues only
 * confidential credentials, so the client_secret is injected here and the
 * browser never sees it.
 */
@Controller('v1/nextgen')
export class NextGenController {
  constructor(@Inject('CONFIG') private readonly config: NextGenModuleConfig) {}

  @Post('token')
  async exchangeToken(
    @Res() response: Response,
    @Body() body: TokenExchangeRequest,
  ) {
    await this.forwardTokenRequest(response, 'token exchange', {
      grant_type: 'authorization_code',
      code: body.code,
      redirect_uri: body.redirect_uri,
    });
  }

  @Post('refresh')
  async refreshToken(
    @Res() response: Response,
    @Body() body: TokenRefreshRequest,
  ) {
    await this.forwardTokenRequest(response, 'token refresh', {
      grant_type: 'refresh_token',
      refresh_token: body.refresh_token,
    });
  }

  private async forwardTokenRequest(
    response: Response,
    operation: string,
    grantParams: Record<string, string>,
  ) {
    try {
      // NextGen's token endpoint reads params from the query string (Patient API Auth Guide).
      const params = new URLSearchParams({
        ...grantParams,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const tokenResponse = await fetch(
        `${NEXTGEN_CONSTANTS.TOKEN_URL}?${params}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const body = await tokenResponse.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(body);
      } catch {
        data = {
          error: 'upstream_error',
          error_description: `NextGen returned a non-JSON response (status ${tokenResponse.status})`,
        };
      }

      if (!tokenResponse.ok) {
        Logger.error(
          `NextGen ${operation} failed (${tokenResponse.status}): ${data['error']} ${data['error_description'] ?? ''}`,
        );
        response.status(tokenResponse.status).send(data);
        return;
      }

      response.json(data);
    } catch (e) {
      Logger.error(`NextGen ${operation} error:`, e);
      response.status(500).send({
        error: 'token_request_error',
        error_description: `NextGen ${operation} failed`,
      });
    }
  }
}
