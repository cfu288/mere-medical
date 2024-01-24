import { Module } from '@nestjs/common';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';

// Used to serve PWA React App
@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web'),
      serveStaticOptions: {
        extensions: ['.json'],
      },
    }),
  ],
})
export class StaticModule {}
