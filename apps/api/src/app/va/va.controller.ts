import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@Controller('v1/va')
export class VAController {
  @ApiTags('app-redirect')
  @ApiOkResponse({
    description:
      'The app successfully authenticated, and the user is being redirected to the app.',
  })
  @Get('app-redirect')
  // https://localhost:4200/api/v1/va/app-redirect
  async redirectToApp(@Res() response: Response, @Query('code') code: string) {
    try {
      response.send(`<html><head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://unpkg.com/spectre.css/dist/spectre.min.css">
      <link rel="stylesheet" href="https://unpkg.com/spectre.css/dist/spectre-exp.min.css">
      <link rel="stylesheet" href="https://unpkg.com/spectre.css/dist/spectre-icons.min.css">
      <title>Redirecting to Mere...</title>
      <script>
          var redirectToApp = function() {
              window.location.replace("mere://va/callback?code=${code}");
          };
          window.onload = redirectToApp;
      </script>
      </head>
      <body>
      <main class="container grid-lg">
      <h1>Redirecting to Mere...</h1>
      <p>If you are not redirected automatically, please <a href="mere://va/callback?code=${code}">click here</a> to try again.</p>
      </main>
      </body></html>`);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
