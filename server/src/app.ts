import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import type { Repository } from './repository.ts';
import type { VerifyToken } from './auth.ts';
import type { Ai } from './ai.ts';
import { ApiError } from './errors.ts';
import {
  courseInput,
  id,
  lectureInput,
  profileInput,
  reviewInput,
  uploadInput,
} from './validation.ts';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export async function buildApp(deps: {
  repo: Repository;
  verify: VerifyToken;
  ai: Ai;
  ping: () => Promise<void>;
  origins: string[];
  logger?: boolean;
}) {
  const app = Fastify({
    logger: deps.logger
      ? {
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
          level: 'info',
        }
      : false,
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    bodyLimit: 256 * 1024,
    requestTimeout: 90000,
    connectionTimeout: 10000,
  });
  const repo = deps.repo;
  await app.register(cors, {
    origin: deps.origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.decorateRequest('userId', '');
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
  });
  app.setErrorHandler((error, request, reply) => {
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Try again with the request ID if the problem continues.';
    if (error instanceof ZodError) {
      status = 400;
      code = 'INVALID_INPUT';
      message = 'Check the submitted fields and try again.';
    } else if (error instanceof ApiError) {
      status = error.statusCode;
      code = error.code;
      message = error.message;
    } else if ((error as { code?: string }).code === '23505') {
      status = 409;
      code = 'CONFLICT';
      message = 'This item already exists.';
    } else if (['23503', '23514'].includes((error as { code?: string }).code ?? '')) {
      status = 400;
      code = 'INVALID_REFERENCE';
      message = 'Check the selected course or profile.';
    } else if ((error as { code?: string }).code === '42501') {
      status = 403;
      code = 'FORBIDDEN';
      message = 'You do not have access to this action.';
    } else if ([400, 413, 415, 429].includes((error as { statusCode?: number }).statusCode ?? 0)) {
      status = (error as { statusCode: number }).statusCode;
      code = 'REQUEST_REJECTED';
      message =
        status === 429
          ? 'Too many requests. Please wait a minute.'
          : 'The request format or size is unsupported.';
    }
    if (status >= 500)
      request.log.error(
        { requestId: request.id, code: (error as { code?: string }).code },
        'Request failed',
      );
    void reply.status(status).send({ error: { code, message, requestId: request.id } });
  });
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      await deps.ping();
      return { status: 'ready' };
    } catch {
      return reply.status(503).send({ status: 'unavailable' });
    }
  });
  await app.register(
    async (api) => {
      api.addHook('onRequest', async (request) => {
        const authorization = request.headers.authorization;
        if (!authorization?.startsWith('Bearer ') || authorization.length > 10000)
          throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
        request.userId = await deps.verify(authorization.slice(7));
      });
      const param = (params: unknown) => z.object({ id }).parse(params).id;
      api.get('/me', async (r) => ({ id: r.userId }));
      api.get('/profile', async (r) => repo.profile(r.userId));
      api.put('/profile', async (r) => repo.saveProfile(r.userId, profileInput.parse(r.body)));
      api.get('/profiles', async (r) => {
        const { q } = z.object({ q: z.string().trim().min(2).max(100) }).parse(r.query);
        return repo.searchProfiles(r.userId, q);
      });
      api.get('/profiles/:id', async (r) =>
        repo.profile(r.userId, z.uuid().parse(param(r.params))),
      );
      api.get('/courses', async (r) => repo.courses(r.userId));
      api.get('/courses/:id', async (r) => repo.course(r.userId, param(r.params)));
      api.post('/courses', async (r, reply) =>
        reply.code(201).send(await repo.createCourse(r.userId, courseInput.parse(r.body))),
      );
      api.get('/enrollments', async (r) => repo.courses(r.userId, true));
      api.put('/enrollments/:id', async (r, reply) => {
        await repo.enroll(r.userId, param(r.params), true);
        return reply.code(204).send();
      });
      api.delete('/enrollments/:id', async (r, reply) => {
        await repo.enroll(r.userId, param(r.params), false);
        return reply.code(204).send();
      });
      api.get('/lectures', async (r) =>
        repo.lectures(r.userId, z.object({ courseId: id }).parse(r.query).courseId),
      );
      api.get('/lectures/:id', async (r) => repo.lecture(r.userId, param(r.params)));
      api.post('/lectures', async (r, reply) => {
        const key = z.uuid().parse(r.headers['idempotency-key']);
        return reply
          .code(201)
          .send(await repo.createLecture(r.userId, key, lectureInput.parse(r.body)));
      });
      api.get('/lectures/:id/sharing', async (r) => repo.sharing(r.userId, param(r.params)));
      api.put('/lectures/:id/sharing', async (r) =>
        repo.setSharing(
          r.userId,
          param(r.params),
          z.object({ shared: z.boolean() }).strict().parse(r.body).shared,
        ),
      );
      api.post('/lectures/:id/copy', async (r) => repo.copyLecture(r.userId, param(r.params)));
      api.get('/shared-lectures', async (r) => {
        const { owners } = z.object({ owners: z.string().max(2000) }).parse(r.query);
        return repo.sharedLectures(
          r.userId,
          z.array(z.uuid()).max(40).parse(owners.split(',').filter(Boolean)),
        );
      });
      api.get('/friendships', async (r) => repo.friendships(r.userId));
      api.post('/friendships', async (r, reply) => {
        await repo.requestFriend(
          r.userId,
          z.object({ addresseeId: z.uuid() }).strict().parse(r.body).addresseeId,
        );
        return reply.code(204).send();
      });
      api.put('/friendships/:id/accept', async (r, reply) => {
        await repo.acceptFriend(r.userId, z.uuid().parse(param(r.params)));
        return reply.code(204).send();
      });
      api.post(
        '/materials',
        { bodyLimit: 15 * 1024 * 1024, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
        async (r, reply) =>
          reply.code(201).send(await repo.upload(r.userId, uploadInput.parse(r.body))),
      );
      api.get('/materials', async (r) =>
        repo.materials(r.userId, z.object({ lectureId: id }).parse(r.query).lectureId),
      );
      api.put('/materials/:id/lecture', async (r) =>
        repo.attach(
          r.userId,
          z.uuid().parse(param(r.params)),
          z.object({ lectureId: id }).strict().parse(r.body).lectureId,
        ),
      );
      api.get('/materials/:id/url', async (r) =>
        repo.materialUrl(r.userId, z.uuid().parse(param(r.params))),
      );
      const aiLimit = {
        config: {
          rateLimit: {
            max: 10,
            timeWindow: '1 minute',
            keyGenerator: (r: { userId: string }) => r.userId,
          },
        },
      };
      api.post('/ai/analyze', aiLimit, async (r) => {
        const { materialId } = z.object({ materialId: z.uuid() }).strict().parse(r.body);
        const { photos } = await repo.context(r.userId, materialId, true);
        return deps.ai.generate('analysis', {}, photos);
      });
      api.post('/ai/ask', aiLimit, async (r) => {
        const { lectureId, question } = z
          .object({ lectureId: id, question: z.string().trim().min(1).max(2000) })
          .strict()
          .parse(r.body);
        const { lecture, photos } = await repo.context(r.userId, lectureId);
        return deps.ai.generate('ask', { lecture, question }, photos);
      });
      api.post('/ai/quiz', aiLimit, async (r) => {
        const { lectureId } = z.object({ lectureId: id }).strict().parse(r.body);
        const { lecture, photos } = await repo.context(r.userId, lectureId);
        return deps.ai.generate('quiz', lecture, photos);
      });
      api.get('/reviews', async (r) => repo.reviews(r.userId));
      api.put('/lectures/:id/review', async (r) =>
        repo.review(r.userId, param(r.params), reviewInput.parse(r.body).confidence),
      );
    },
    { prefix: '/v1' },
  );
  return app;
}
