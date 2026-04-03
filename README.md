# @msuez/backend-core

Backend toolkit for Express + TypeScript. 11 modules, zero config, one import.

```bash
npm install @msuez/backend-core
```

```typescript
import { Logger, ExpressServer, RedisClient, ... } from '@msuez/backend-core';
```

---

## Quick Start

### Step 1 — Logger

Initialize once before anything else. All modules use it internally.

```typescript
import { Logger } from '@msuez/backend-core';

Logger.init({ isDev: process.env.NODE_ENV === 'development', level: 'debug' });

const logger = new Logger('App');
logger.info('Starting...');
```

| Option | Default | Description |
|--------|---------|-------------|
| `isDev` | `false` | Enables pino-pretty for readable dev output |
| `level` | `'debug'` | Log level: `silent`, `fatal`, `error`, `warn`, `info`, `debug`, `trace` |

---

### Step 2 — Errors

Typed error classes for consistent API responses.

```typescript
import { AppError, NotFoundError, ValidationError } from '@msuez/backend-core';

// In a repository
const user = await repo.findOneBy({ id });
if (!user) throw new NotFoundError('User');

// In a service
if (balance < amount) throw new AppError('Insufficient funds', 400, 'INSUFFICIENT_FUNDS');
```

| Class | Status | Code |
|-------|--------|------|
| `AppError` | 500 | `INTERNAL_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ValidationError` | 400 | `VALIDATION_ERROR` |

---

### Step 3 — Validation

Zod middleware for Express routes.

```typescript
import { validate } from '@msuez/backend-core';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

router.post('/', validate(CreateUserSchema, 'body'), controller.create);
router.get('/:id', validate(ParamsSchema, 'params'), controller.getById);
```

Invalid requests automatically throw `ValidationError` with Zod issue details.

---

### Step 4 — Error Handler (Strategy Pattern)

Mount as the last Express middleware. Uses Strategy pattern — extensible without modification.

```typescript
import { createErrorHandler } from '@msuez/backend-core';

app.use(createErrorHandler());
```

Handles `ValidationError` (400 + details), `AppError` (custom status), and unknown errors (500).

**Custom strategies:**

```typescript
import { createErrorHandler, type IErrorStrategy } from '@msuez/backend-core';

class MyCustomErrorStrategy implements IErrorStrategy {
  canHandle(err: Error): boolean { return err instanceof MyCustomError; }
  handle(err: Error, res: Response): void { res.status(418).json({ message: 'Custom!' }); }
}

app.use(createErrorHandler([new MyCustomErrorStrategy(), ...defaultStrategies]));
```

---

### Step 5 — Express Server

Wraps `app.listen()` and `server.close()` cleanly.

```typescript
import { ExpressServer } from '@msuez/backend-core';

const server = new ExpressServer(app, 3000);
server.start();    // Logs: Running on http://localhost:3000
await server.stop(); // Graceful close
```

---

### Step 6 — Graceful Shutdown

Ordered cleanup on SIGTERM/SIGINT. Pass an array of closables.

```typescript
import { GracefulShutdown } from '@msuez/backend-core';

new GracefulShutdown([
  { name: 'HTTP server', close: () => server.stop() },
  { name: 'Worker', close: () => worker.stop() },
  { name: 'Database', close: () => dataSource.destroy() },
  { name: 'Redis', close: () => redis.quit().then(() => {}) },
], 10000).register(); // 10s timeout
```

Logs each step: `1/4 Closing HTTP server...`, `2/4 Closing Worker...`, etc. Forces exit on timeout.

---

### Step 7 — Redis + Cache

Cache-aside pattern with Redis.

```typescript
import { RedisClient, CacheService } from '@msuez/backend-core';

const redis = new RedisClient('redis://localhost:6379');
const cache = new CacheService(redis);

// Cache-aside: fetches from cache or executes the function
const { data, hit } = await cache.getOrFetch('users:list', 300, () => repo.findAll());
// hit = true (from cache) | false (from DB, now cached for 300s)

// Invalidate
await cache.del('users:list', 'user:123');
```

`CacheService` accepts any `ICacheClient` — swap Redis for in-memory in tests.

---

### Step 8 — Typed Event Bus

Generic pub/sub with TypeScript type safety.

```typescript
import { TypedEventBus } from '@msuez/backend-core';

// Define your project's event map
interface IEventMap {
  'user:created': { id: string; email: string };
  'order:placed': { orderId: string; userId: string };
}

const eventBus = new TypedEventBus<IEventMap>();

// Type-safe — payload is inferred
eventBus.on('user:created', (payload) => {
  console.log(payload.email); // TS knows this exists
});

eventBus.emit('user:created', { id: '1', email: 'john@example.com' });
```

---

### Step 9 — Rate Limiter

Configurable rate limiting with Redis. One class, multiple instances.

```typescript
import { RateLimiter } from '@msuez/backend-core';

// Global: 100 req/min by IP
const ipLimiter = new RateLimiter(redis, {
  keyPrefix: 'rl:ip',
  points: 100,
  duration: 60,
  keyExtractor: (req) => req.ip ?? 'unknown',
});
app.use(ipLimiter.handle);

// Per-route: 20 req/min by userId
const userLimiter = new RateLimiter(redis, {
  keyPrefix: 'rl:user',
  points: 20,
  duration: 60,
  keyExtractor: (req) => req.body?.userId ?? null, // null = skip
});
router.post('/', userLimiter.handle, controller.create);
```

Sets `X-RateLimit-Remaining` and `Retry-After` headers automatically.

---

### Step 10 — Distributed Lock

Prevents race conditions with Redis-backed locks (Redlock).

```typescript
import { LockService } from '@msuez/backend-core';

const lockService = new LockService(redis);

const result = await lockService.withLock('product:123', async () => {
  const product = await repo.findById('123');
  if (product.stock < quantity) throw new AppError('No stock', 400, 'NO_STOCK');
  await repo.decrementStock('123', quantity);
  return repo.createOrder(data);
}, 5000); // 5s TTL
```

Throws `AppError(409, 'CONFLICT')` if the lock is already held.

---

### Step 11 — Circuit Breaker

Protects against cascading failures from external services.

```typescript
import { OpossumeCircuitBreaker } from '@msuez/backend-core';

const breaker = new OpossumeCircuitBreaker(
  (payload: INotificationPayload) => externalApi.send(payload),
  { timeout: 5000, errorThresholdPercentage: 50, resetTimeout: 30000 },
);

await breaker.fire(payload);
console.log(breaker.state); // 'closed' | 'open' | 'half-open'
```

States: `closed` (normal) → `open` (failing, fast-reject) → `half-open` (testing recovery).
Throws `AppError(503, 'CIRCUIT_OPEN')` when open.

---

### Step 12 — Health Checks

Composable health checks with built-in checks for Postgres, Redis, and Circuit Breaker.

```typescript
import {
  HealthChecker, PostgresHealthCheck, RedisHealthCheck, CircuitBreakerHealthCheck,
} from '@msuez/backend-core';

const healthChecker = new HealthChecker([
  new PostgresHealthCheck(dataSource),   // SELECT 1
  new RedisHealthCheck(redis),            // PING → PONG
  new CircuitBreakerHealthCheck(breaker), // state !== 'open'
]);

app.get('/health', async (_req, res) => {
  const { result, httpStatus } = await healthChecker.check();
  res.status(httpStatus).json(result);
});
// 200 { status: 'ok', services: { postgres: { status: 'ok' }, ... } }
// 503 { status: 'degraded', services: { redis: { status: 'error', message: '...' } } }
```

**Custom health checks:**

```typescript
import { type IHealthCheck, type IServiceStatus } from '@msuez/backend-core';

class ExternalApiHealthCheck implements IHealthCheck {
  readonly name = 'external-api';

  async check(): Promise<IServiceStatus> {
    try {
      await fetch('https://api.example.com/ping');
      return { status: 'ok' };
    } catch {
      return { status: 'error', message: 'Unreachable' };
    }
  }
}

// Add to the array — zero changes to HealthChecker (OCP)
const healthChecker = new HealthChecker([
  new PostgresHealthCheck(dataSource),
  new RedisHealthCheck(redis),
  new ExternalApiHealthCheck(),
]);
```

---

## Full Example

```typescript
import 'reflect-metadata';
import express from 'express';
import {
  Logger, RedisClient, CacheService, TypedEventBus, LockService,
  ExpressServer, GracefulShutdown, RateLimiter, createErrorHandler,
  HealthChecker, PostgresHealthCheck, RedisHealthCheck, validate,
} from '@msuez/backend-core';

// 1. Logger
Logger.init({ isDev: process.env.NODE_ENV === 'development' });

// 2. Redis + shared services
const redis = new RedisClient(process.env.REDIS_URL || 'redis://localhost:6379');
const cache = new CacheService(redis);
const eventBus = new TypedEventBus<IEventMap>();
const lockService = new LockService(redis);

// 3. Express app
const app = express();
app.use(express.json());
app.use(new RateLimiter(redis, {
  keyPrefix: 'rl:ip', points: 100, duration: 60,
  keyExtractor: (req) => req.ip ?? 'unknown',
}).handle);

// 4. Health
app.get('/health', async (_req, res) => {
  const { result, httpStatus } = await new HealthChecker([
    new PostgresHealthCheck(dataSource),
    new RedisHealthCheck(redis),
  ]).check();
  res.status(httpStatus).json(result);
});

// 5. Routes
app.use('/products', productRoutes);
app.use(createErrorHandler());

// 6. Start + shutdown
const server = new ExpressServer(app, 3000);
server.start();

new GracefulShutdown([
  { name: 'HTTP server', close: () => server.stop() },
  { name: 'Database', close: () => dataSource.destroy() },
  { name: 'Redis', close: () => redis.quit().then(() => {}) },
]).register();
```

---

## Modules

| Module | Exports | Pattern |
|--------|---------|---------|
| **logger** | `Logger`, `ILoggerConfig` | Adapter (pino) |
| **errors** | `AppError`, `NotFoundError`, `ValidationError`, `createErrorHandler`, `IErrorStrategy` | Strategy |
| **validate** | `validate` | Middleware |
| **server** | `ExpressServer` | Facade |
| **shutdown** | `GracefulShutdown`, `IClosable` | Composite + Command |
| **cache** | `RedisClient`, `CacheService`, `ICacheClient`, `ICacheResult` | Decorator |
| **events** | `TypedEventBus<T>` | Observer |
| **rate-limiter** | `RateLimiter`, `IRateLimiterConfig` | Middleware |
| **lock** | `LockService` | Facade (Redlock) |
| **circuit-breaker** | `OpossumeCircuitBreaker`, `ICircuitBreaker`, `ICircuitBreakerState` | Adapter + Decorator |
| **health** | `HealthChecker`, `PostgresHealthCheck`, `RedisHealthCheck`, `CircuitBreakerHealthCheck`, `IHealthCheck` | Composite + Strategy |

## Peer Dependencies

Install these in your project (they are NOT bundled):

```bash
npm install express zod
```

## License

MIT
