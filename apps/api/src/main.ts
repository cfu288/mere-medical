/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import * as fs from 'fs';
import * as path from 'path';
import { environment } from './environments/environment';
import { RootModule } from './app/root.module';

async function bootstrap() {
  const globalPrefix = 'api';
  // only enable ssl in dev, prod has a reverse proxy
  const ssl = environment.production === false;
  Logger.log(
    `Running in ${environment.production ? 'production' : 'development'} mode`
  );
  let httpsOptions = null;
  if (ssl) {
    const keyPath = '../../../dev-stack/certs/localhost-key.pem' || '';
    const certPath = '../../../dev-stack/certs/localhost.pem' || '';
    httpsOptions = {
      key: fs.readFileSync(path.join(__dirname, keyPath)),
      cert: fs.readFileSync(path.join(__dirname, certPath)),
    };
  }

  const app = await NestFactory.create(RootModule, { httpsOptions });
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 80;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http${
      ssl ? 's' : ''
    }://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
