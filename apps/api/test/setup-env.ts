// Variables de entorno fijas para los tests. Se cargan con `setupFiles` de Jest, antes de importar
// cualquier módulo, porque ConfigModule valida el entorno en el momento de importar AppModule.
// Ninguna de estas conexiones se abre: el pool de pg es perezoso y los tests no tocan la BD.
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@127.0.0.1:5433/xrlab_test';
process.env['CORS_ORIGINS'] = 'http://allowed.test';
process.env['THROTTLE_TTL_MS'] = '60000';
process.env['THROTTLE_LIMIT'] = '20';
process.env['JWT_ACCESS_SECRET'] = 'test-secret-test-secret-test-secret-0123456789';
