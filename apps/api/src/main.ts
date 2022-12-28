/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import * as fs from 'fs';
import * as path from 'path';
import { RootModule } from './app/root.module';

async function bootstrap() {
  const globalPrefix = 'api';
  // only enable ssl in dev, prod has a reverse proxy
  const ssl = process.env.NODE_ENV === 'development';
  Logger.log(
    `Running in ${
      process.env.NODE_ENV === 'production' ? 'production' : 'development'
    } mode`
  );

  let httpsOptions = null;
  if (ssl) {
    const keyPath = '../../../dev-stack/certs/localhost-key.pem' || '';
    const certPath = '../../../dev-stack/certs/localhost.pem' || '';
    httpsOptions = {
      key: fs.readFileSync(path.join(__dirname, keyPath)),
      cert: fs.readFileSync(path.join(__dirname, certPath)),
      logger: ['error', 'warn', 'debug', 'verbose', 'log'],
      bodyParser: false,
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
