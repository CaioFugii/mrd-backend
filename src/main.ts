import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { PORT } from './shared/environment/app';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.useLogger(app.get(Logger));

    app.use(helmet());

    app.use(compression());

    app.enableCors();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.listen(PORT);
    const logger = app.get(Logger);
    logger.log(`🚀 API listening on port: ${PORT}`, 'Bootstrap');
  } catch (error) {
    console.error('❌ Error starting the application', error);
    process.exit(1);
  }
}

bootstrap();
