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

### Step 13 — WebSocket (Socket.IO)

Real-time communication with rooms, namespaces, auth middleware, and typed events. Integrates with ExpressServer and GracefulShutdown.

```typescript
import { ExpressServer, WebSocketServer } from '@msuez/backend-core';

const expressServer = new ExpressServer(app, 3000);
expressServer.start();

const wss = new WebSocketServer(expressServer.getHttpServer()!, {
  cors: { origin: 'http://localhost:5173', credentials: true },
  connectionStateRecovery: { maxDisconnectionDuration: 120000 },
});
```

**Auth middleware:**

```typescript
wss.use({
  name: 'auth',
  handle(socket, next) {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    socket.data.userId = verifyToken(token);
    next();
  },
});
```

**Namespace-specific middleware:**

```typescript
wss.useOn('/admin', {
  name: 'admin-auth',
  handle(socket, next) {
    if (!socket.data.isAdmin) return next(new Error('Forbidden'));
    next();
  },
});
```

**Connection handling + rooms:**

```typescript
wss.onConnection((socket) => {
  socket.join(`user:${socket.data.userId}`);

  socket.on('chat:message', (data) => {
    wss.toRoom(data.roomId, 'chat:message', {
      userId: socket.data.userId,
      text: data.text,
    });
  });

  socket.on('chat:join', (roomId) => {
    socket.join(roomId);
  });
});
```

**Broadcast:**

```typescript
wss.broadcast('notification', { message: 'Server update' });         // all clients
wss.broadcastTo('/admin', 'alert', { level: 'critical' });           // all in namespace
wss.toRoom('room-1', 'chat:message', { text: 'Hello room!' });      // specific room
wss.toRoomIn('/chat', 'room-1', 'typing', { userId: 'user-1' });   // room in namespace
```

**Metrics:**

```typescript
wss.getConnectionCount();   // number of connected clients
wss.getRooms();             // Map<roomName, Set<socketId>>
wss.getRooms('/chat');       // rooms in specific namespace
```

**Shutdown — WebSocket closes BEFORE HTTP server:**

```typescript
new GracefulShutdown([
  wss,  // implements IClosable — { name: 'WebSocket server', close() }
  { name: 'HTTP server', close: () => expressServer.stop() },
  { name: 'Redis', close: () => redis.quit().then(() => {}) },
]).register();
```

**Advanced — access socket.io Server directly:**

```typescript
const io = wss.getIO();
io.of(/^\/tenant-\d+$/).on('connection', (socket) => {
  // Dynamic namespaces with regex
});
```

| Config | Default | Description |
|--------|---------|-------------|
| `cors` | — | CORS config `{ origin, methods, credentials }` |
| `pingInterval` | `25000` | Server heartbeat interval (ms) |
| `pingTimeout` | `20000` | Client must respond within (ms) |
| `connectionStateRecovery` | — | `{ maxDisconnectionDuration, skipMiddlewares }` |
| `path` | `'/socket.io'` | WebSocket endpoint path |
| `cleanupEmptyChildNamespaces` | `true` | Auto-cleanup dynamic namespaces |

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

## Examples

### Example 1 — Minimal API Server

Logger + Express Server + Error Handler + Graceful Shutdown.

```
src/
├── app.ts
├── config/
│   └── env.ts
├── users/
│   ├── user.controller.ts
│   └── user.routes.ts
└── bootstrap.ts
```

**`src/config/env.ts`**

```typescript
export class AppConfig {
  static readonly port = Number(process.env.PORT) || 3000;
  static readonly isDev = process.env.NODE_ENV === 'development';
}
```

**`src/users/user.controller.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '@msuez/backend-core';

const users: Record<string, string> = { '1': 'Alice', '2': 'Bob' };

export class UserController {
  getById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = users[req.params.id];
      if (!user) throw new NotFoundError('User');
      res.json({ status: 'success', data: { id: req.params.id, name: user } });
    } catch (err) {
      next(err);
    }
  };
}
```

**`src/users/user.routes.ts`**

```typescript
import { Router } from 'express';
import { UserController } from './user.controller';

export function createUserRoutes(): Router {
  const controller = new UserController();
  const router = Router();
  router.get('/:id', controller.getById);
  return router;
}
```

**`src/bootstrap.ts`**

```typescript
import express from 'express';
import { Logger, ExpressServer, GracefulShutdown, createErrorHandler } from '@msuez/backend-core';
import { AppConfig } from './config/env';
import { createUserRoutes } from './users/user.routes';

export async function bootstrap(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/ping', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/users', createUserRoutes());
  app.use(createErrorHandler());

  const server = new ExpressServer(app, AppConfig.port);
  server.start();

  new GracefulShutdown([
    { name: 'HTTP server', close: () => server.stop() },
  ]).register();
}
```

**`src/app.ts`**

```typescript
import { Logger } from '@msuez/backend-core';
import { AppConfig } from './config/env';
import { bootstrap } from './bootstrap';

Logger.init({ isDev: AppConfig.isDev });
bootstrap().catch((err) => {
  new Logger('App').error('Failed to start', { error: err.message });
  process.exit(1);
});
```

```bash
curl localhost:3000/ping       # 200 { status: 'ok', timestamp: '...' }
curl localhost:3000/users/1    # 200 { status: 'success', data: { id: '1', name: 'Alice' } }
curl localhost:3000/users/99   # 404 { status: 'error', code: 'NOT_FOUND' }
```

---

### Example 2 — API with Redis: Cache, Rate Limiting, and Validation

Adds Redis, Zod validation, cache-aside, rate limiting, and health check.

```
src/
├── app.ts
├── config/
│   └── env.ts
├── products/
│   ├── product.controller.ts
│   ├── product.routes.ts
│   ├── product.schemas.ts
│   └── product.service.ts
└── bootstrap.ts
```

**`src/config/env.ts`**

```typescript
export class AppConfig {
  static readonly port = Number(process.env.PORT) || 3000;
  static readonly isDev = process.env.NODE_ENV === 'development';
  static readonly redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
}
```

**`src/products/product.schemas.ts`**

```typescript
import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});
```

**`src/products/product.service.ts`**

```typescript
import type { CacheService } from '@msuez/backend-core';

interface IProduct {
  id: string;
  name: string;
  price: number;
}

const products = new Map<string, IProduct>();

export class ProductService {
  constructor(private readonly cache: CacheService) {}

  async getAll(): Promise<IProduct[]> {
    const { data } = await this.cache.getOrFetch('products:list', 60, async () => {
      return Array.from(products.values());
    });
    return data;
  }

  async create(data: { name: string; price: number }): Promise<IProduct> {
    const product = { id: crypto.randomUUID(), ...data };
    products.set(product.id, product);
    await this.cache.del('products:list');
    return product;
  }
}
```

**`src/products/product.controller.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { ProductService } from './product.service';

export class ProductController {
  constructor(private readonly service: ProductService) {}

  getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await this.service.getAll();
      res.json({ status: 'success', data: products });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.service.create(req.body);
      res.status(201).json({ status: 'success', data: product });
    } catch (err) { next(err); }
  };
}
```

**`src/products/product.routes.ts`**

```typescript
import { Router } from 'express';
import { validate } from '@msuez/backend-core';
import { ProductController } from './product.controller';
import { CreateProductSchema } from './product.schemas';

export function createProductRoutes(controller: ProductController): Router {
  const router = Router();
  router.get('/', controller.getAll);
  router.post('/', validate(CreateProductSchema, 'body'), controller.create);
  return router;
}
```

**`src/bootstrap.ts`**

```typescript
import express from 'express';
import {
  Logger, ExpressServer, GracefulShutdown, createErrorHandler,
  RedisClient, CacheService, RateLimiter,
  HealthChecker, RedisHealthCheck,
} from '@msuez/backend-core';
import { AppConfig } from './config/env';
import { ProductService } from './products/product.service';
import { ProductController } from './products/product.controller';
import { createProductRoutes } from './products/product.routes';

export async function bootstrap(): Promise<void> {
  // Services
  const redis = new RedisClient(AppConfig.redisUrl);
  const cache = new CacheService(redis);

  // Product module
  const productService = new ProductService(cache);
  const productController = new ProductController(productService);

  // Health
  const healthChecker = new HealthChecker([new RedisHealthCheck(redis)]);

  // Express
  const app = express();
  app.use(express.json());
  app.use(new RateLimiter(redis, {
    keyPrefix: 'rl:ip', points: 100, duration: 60,
    keyExtractor: (req) => req.ip ?? 'unknown',
  }).handle);

  app.get('/health', async (_req, res) => {
    const { result, httpStatus } = await healthChecker.check();
    res.status(httpStatus).json(result);
  });

  app.use('/products', createProductRoutes(productController));
  app.use(createErrorHandler());

  // Start
  const server = new ExpressServer(app, AppConfig.port);
  server.start();

  new GracefulShutdown([
    { name: 'HTTP server', close: () => server.stop() },
    { name: 'Redis', close: () => redis.quit().then(() => {}) },
  ]).register();
}
```

**`src/app.ts`**

```typescript
import { Logger } from '@msuez/backend-core';
import { AppConfig } from './config/env';
import { bootstrap } from './bootstrap';

Logger.init({ isDev: AppConfig.isDev });
bootstrap().catch((err) => {
  new Logger('App').error('Failed to start', { error: err.message });
  process.exit(1);
});
```

```bash
curl -X POST localhost:3000/products \
  -H 'Content-Type: application/json' \
  -d '{"name": "Laptop", "price": 999}'     # 201 created

curl -X POST localhost:3000/products \
  -H 'Content-Type: application/json' \
  -d '{"name": "", "price": -5}'             # 400 validation error

curl localhost:3000/products                  # 200 (cached after first call)
curl localhost:3000/health                    # 200 { status: 'ok', services: { redis: ... } }
```

---

### Example 3 — Event-Driven with Lock, Circuit Breaker, and Full Health

Complete setup: typed events, distributed lock, circuit breaker, all health checks.

```
src/
├── app.ts
├── config/
│   ├── env.ts
│   ├── database.ts
│   └── events.ts
├── orders/
│   ├── order.controller.ts
│   ├── order.routes.ts
│   ├── order.schemas.ts
│   ├── order.service.ts
│   └── order.listener.ts
├── payments/
│   └── payment.client.ts
└── infra/
    ├── ServiceContainer.ts
    └── AppBootstrap.ts
```

**`src/config/events.ts`**

```typescript
export interface IEventMap {
  'order:created': { orderId: string; userId: string; total: number };
  'payment:failed': { orderId: string; reason: string };
}
```

**`src/config/env.ts`**

```typescript
export class AppConfig {
  static readonly port = Number(process.env.PORT) || 3000;
  static readonly isDev = process.env.NODE_ENV === 'development';
  static readonly redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  static readonly paymentApiUrl = process.env.PAYMENT_API_URL || 'https://api.payments.com/charge';
}
```

**`src/payments/payment.client.ts`**

```typescript
import { OpossumeCircuitBreaker, type ICircuitBreakerState } from '@msuez/backend-core';

interface IPaymentPayload {
  orderId: string;
  amount: number;
}

export class PaymentClient implements ICircuitBreakerState {
  private readonly breaker: OpossumeCircuitBreaker<[IPaymentPayload], unknown>;

  constructor(apiUrl: string) {
    this.breaker = new OpossumeCircuitBreaker(
      async (data: IPaymentPayload) => {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Payment API: ${res.status}`);
        return res.json();
      },
    );
  }

  get state(): string { return this.breaker.state; }

  async charge(orderId: string, amount: number): Promise<void> {
    await this.breaker.fire({ orderId, amount });
  }
}
```

**`src/orders/order.schemas.ts`**

```typescript
import { z } from 'zod';

export const CreateOrderSchema = z.object({
  userId: z.string().min(1),
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
});
```

**`src/orders/order.service.ts`**

```typescript
import { AppError, type TypedEventBus, type LockService } from '@msuez/backend-core';
import type { IEventMap } from '../config/events';

export class OrderService {
  constructor(
    private readonly eventBus: TypedEventBus<IEventMap>,
    private readonly lockService: LockService,
  ) {}

  async create(data: { userId: string; productId: string; quantity: number }) {
    return this.lockService.withLock(`product:${data.productId}`, async () => {
      // your DB calls here: validate stock, decrement, create order
      const order = { id: crypto.randomUUID(), ...data, total: 999 * data.quantity };

      this.eventBus.emit('order:created', {
        orderId: order.id,
        userId: data.userId,
        total: order.total,
      });

      return order;
    });
  }
}
```

**`src/orders/order.controller.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { OrderService } from './order.service';

export class OrderController {
  constructor(private readonly service: OrderService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.service.create(req.body);
      res.status(201).json({ status: 'success', data: order });
    } catch (err) { next(err); }
  };
}
```

**`src/orders/order.routes.ts`**

```typescript
import { Router } from 'express';
import { validate } from '@msuez/backend-core';
import { OrderController } from './order.controller';
import { CreateOrderSchema } from './order.schemas';

export function createOrderRoutes(controller: OrderController): Router {
  const router = Router();
  router.post('/', validate(CreateOrderSchema, 'body'), controller.create);
  return router;
}
```

**`src/orders/order.listener.ts`**

```typescript
import { Logger, type TypedEventBus } from '@msuez/backend-core';
import type { IEventMap } from '../config/events';
import type { PaymentClient } from '../payments/payment.client';

const logger = new Logger('OrderEvents');

export class OrderListener {
  constructor(
    private readonly eventBus: TypedEventBus<IEventMap>,
    private readonly paymentClient: PaymentClient,
  ) {}

  register(): void {
    this.eventBus.on('order:created', (payload) => {
      logger.info(`Order ${payload.orderId} — charging $${payload.total}`);
      this.paymentClient.charge(payload.orderId, payload.total)
        .catch(() => this.eventBus.emit('payment:failed', {
          orderId: payload.orderId,
          reason: 'Payment service unavailable',
        }));
    });

    this.eventBus.on('payment:failed', (payload) => {
      logger.warn(`Payment failed for ${payload.orderId}: ${payload.reason}`);
    });
  }
}
```

**`src/infra/ServiceContainer.ts`**

```typescript
import { RedisClient, TypedEventBus, LockService } from '@msuez/backend-core';
import type { IEventMap } from '../config/events';
import { AppConfig } from '../config/env';

export class ServiceContainer {
  readonly redis = new RedisClient(AppConfig.redisUrl);
  readonly eventBus = new TypedEventBus<IEventMap>();
  readonly lockService = new LockService(this.redis);
}
```

**`src/infra/AppBootstrap.ts`**

```typescript
import express from 'express';
import {
  Logger, ExpressServer, GracefulShutdown, createErrorHandler, RateLimiter,
  HealthChecker, RedisHealthCheck, CircuitBreakerHealthCheck,
} from '@msuez/backend-core';
import { AppConfig } from '../config/env';
import { ServiceContainer } from './ServiceContainer';
import { PaymentClient } from '../payments/payment.client';
import { OrderService } from '../orders/order.service';
import { OrderController } from '../orders/order.controller';
import { createOrderRoutes } from '../orders/order.routes';
import { OrderListener } from '../orders/order.listener';

const logger = new Logger('App');

export class AppBootstrap {
  async start(): Promise<void> {
    const container = new ServiceContainer();
    const paymentClient = new PaymentClient(AppConfig.paymentApiUrl);

    // Module wiring
    const orderService = new OrderService(container.eventBus, container.lockService);
    const orderController = new OrderController(orderService);
    new OrderListener(container.eventBus, paymentClient).register();

    // Health
    const healthChecker = new HealthChecker([
      new RedisHealthCheck(container.redis),
      new CircuitBreakerHealthCheck(paymentClient),
    ]);

    // Express
    const app = express();
    app.use(express.json());
    app.use(new RateLimiter(container.redis, {
      keyPrefix: 'rl:ip', points: 100, duration: 60,
      keyExtractor: (req) => req.ip ?? 'unknown',
    }).handle);

    app.get('/health', async (_req, res) => {
      const { result, httpStatus } = await healthChecker.check();
      res.status(httpStatus).json(result);
    });

    app.use('/orders', createOrderRoutes(orderController));
    app.use(createErrorHandler());

    const server = new ExpressServer(app, AppConfig.port);
    server.start();

    new GracefulShutdown([
      { name: 'HTTP server', close: () => server.stop() },
      { name: 'Redis', close: () => container.redis.quit().then(() => {}) },
    ]).register();

    logger.info('Application started successfully');
  }
}
```

**`src/app.ts`**

```typescript
import { Logger } from '@msuez/backend-core';
import { AppConfig } from './config/env';
import { AppBootstrap } from './infra/AppBootstrap';

Logger.init({ isDev: AppConfig.isDev });
new AppBootstrap().start().catch((err) => {
  new Logger('App').error('Failed to start', { error: err.message });
  process.exit(1);
});
```

```bash
# Create order with distributed lock
curl -X POST localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"userId": "user-1", "productId": "550e8400-e29b-41d4-a716-446655440000", "quantity": 2}'
# 201 { status: 'success', data: { id: '...', total: 1998 } }

# Health with circuit breaker
curl localhost:3000/health
# 200 { status: 'ok', services: { redis: ..., circuitBreaker: { status: 'ok', message: 'closed' } } }
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
| **websocket** | `WebSocketServer`, `IWebSocketEvents`, `IWebSocketServerConfig`, `IWebSocketMiddleware` | Facade (socket.io) |

## Peer Dependencies

Install these in your project (they are NOT bundled):

```bash
npm install express zod
```

## License

MIT
