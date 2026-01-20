import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { buildVARedirectUrl } from './va.utils';

@Controller('v1/va')
export class VAController {
  @Get('app-redirect')
  async redirectToApp(
    @Res() response: Response,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    try {
      const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:4200';
      const redirectUrl = buildVARedirectUrl(webAppUrl, code, state);

      response.send(`<html><head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://unpkg.com/spectre.css/dist/spectre.min.css">
      <link rel="stylesheet" href="https://unpkg.com/spectre.css/dist/spectre-exp.min.css">
      <link rel="stylesheet" href="https://unpkg.com/spectre.css/dist/spectre-icons.min.css">
      <title>Redirecting to Mere...</title>
      <script>
          var redirectToApp = function() {
              window.location.replace("${redirectUrl}");
          };
          window.onload = redirectToApp;
      </script>
      </head>
      <body>
      <main class="container grid-lg">
      <h1>Redirecting to Mere...</h1>
      <p>If you are not redirected automatically, please <a href="${redirectUrl}">click here</a> to try again.</p>
      </main>
      </body></html>`);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
