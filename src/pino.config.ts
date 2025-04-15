import { RequestMethod } from '@nestjs/common';

const EXCLUDE_ROUTES_LOGGING = [
  {
    method: RequestMethod.ALL,
    path: '/swagger/swagger-ui.css',
  },
  {
    method: RequestMethod.ALL,
    path: '/swagger',
  },
  {
    method: RequestMethod.ALL,
    path: '/swagger/swagger-ui-bundle.js',
  },
  {
    method: RequestMethod.ALL,
    path: '/swagger/swagger-ui-standalone-preset.js',
  },
  {
    method: RequestMethod.ALL,
    path: '/swagger/swagger-ui-init.js',
  },
  {
    method: RequestMethod.ALL,
    path: '/swagger/favicon-32x32.png',
  },
];

export default {
  pinoHttp: {
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        query: req.query,
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
      err: (err) => ({
        type: err.type,
        message: err.message,
        // stack: err.stack,
      }),
    },
    autoLogging: false,
    exclude: EXCLUDE_ROUTES_LOGGING,
  },
};
