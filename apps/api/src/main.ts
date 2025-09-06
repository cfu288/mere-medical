import compression from 'compression';
import * as fs from 'fs';
import * as path from 'path';

import { Logger, LogLevel } from '@nestjs/common';
import { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app/app.module';

const DEFAULT_PORT = 80;
const GLOBAL_PREFIX = 'api';
const DEV_SSL_KEY_PATH = '../../../.dev/certs/localhost-key.pem';
const DEV_SSL_CERT_PATH = '../../../.dev/certs/localhost.pem';
const LOGGING_LEVELS: LogLevel[] = ['error', 'warn', 'log'];

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

function getHttpsOptions(): NestApplicationOptions['httpsOptions'] | undefined {
  if (!isDevelopmentMode()) {
    Logger.log(`Development SSL certs skipped in production.`);
    return undefined;
  }

  Logger.log(`Enabling development SSL.`);
  const keyPath = DEV_SSL_KEY_PATH;
  const certPath = DEV_SSL_CERT_PATH;
  return {
    key: fs.readFileSync(path.join(__dirname, keyPath)),
    cert: fs.readFileSync(path.join(__dirname, certPath)),
  };
}

async function bootstrap() {
  const isDevMode = isDevelopmentMode();
  Logger.log(`Running in ${isDevMode ? 'development' : 'production'} mode`);

  const httpsOptions = getHttpsOptions();

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
    bodyParser: false,
    bufferLogs: true,
    logger: LOGGING_LEVELS,
  });
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.use(compression());

  const config = new DocumentBuilder()
    .setTitle('Mere API')
    .setDescription(
      'This is the API service used to power certain aspects of the Mere client application.',
    )
    .addTag(
      'proxy',
      'Proxy endpoint used by EPIC connections if the `use_proxy` setting is enabled in the client',
    )
    .addTag(
      'tenant',
      'Search for available tenants (hospital/clinics/providers) for a given EMR',
    )
    .addTag(
      'app-redirect',
      "Endpoints used to redirect the user's browser to the appropriate app after authentication",
    )
    .addTag('health', 'Health check endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(GLOBAL_PREFIX, app, document);

  const port = process.env.PORT || DEFAULT_PORT;
  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http${isDevMode ? 's' : ''}://localhost:${port}/${GLOBAL_PREFIX}`,
  );
}

bootstrap();
