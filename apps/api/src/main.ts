import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import * as fs from 'fs';
import * as path from 'path';
import { RootModule } from './app/root.module';
import * as compression from 'compression';

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
      //TODO: apply this only to proxy routes
      bodyParser: false,
    };
  }

  const app = await NestFactory.create(RootModule, { httpsOptions });
  app.setGlobalPrefix(globalPrefix);
  app.use(compression());
  const port = process.env.PORT || 80;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http${
      ssl ? 's' : ''
    }://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
