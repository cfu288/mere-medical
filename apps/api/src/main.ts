import * as compression from 'compression';
import * as fs from 'fs';
import * as path from 'path';

import { Logger as PinoLogger } from 'nestjs-pino';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';

import { AppModule } from './app/app.module';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,
});

async function bootstrap() {
  const globalPrefix = 'api';
  // only enable ssl in dev, prod has a reverse proxy
  const ssl = process.env.NODE_ENV === 'development';
  Logger.log(
    `Running in ${
      process.env.NODE_ENV !== 'development' ? 'production' : 'development'
    } mode`
  );

  let httpsOptions = null;
  if (ssl) {
    Logger.log(`Enabling development SSL.`);
    const keyPath = '../../../.dev/certs/localhost-key.pem' || '';
    const certPath = '../../../.dev/certs/localhost.pem' || '';
    httpsOptions = {
      key: fs.readFileSync(path.join(__dirname, keyPath)),
      cert: fs.readFileSync(path.join(__dirname, certPath)),
      //TODO: apply this only to proxy routes
      bodyParser: false,
    };
  } else {
    Logger.log(`Development SSL certs skipped in production.`);
  }

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
    bufferLogs: true,
    logger: ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix(globalPrefix);
  app.use(compression());
  const port = process.env.PORT || 80;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http${
      ssl ? 's' : ''
    }://localhost:${port}/${globalPrefix}`
  );

  app.useLogger(app.get(PinoLogger));
}

bootstrap();
