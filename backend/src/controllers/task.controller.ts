import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export async function listTasks(req: AuthRequest, res: Response) {
  const {
    page = '1', limit = '20', status, priority, category,
    clientId, assigneeId, search,
  } = req.query as Record<string, string>;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = {
    organisationId: req.user!.orgId,
    parentTaskId: null,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(category && { category }),
    ...(clientId && { clientId }),
    ...(assigneeId && { assigneeId }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      include: {
        client: { select: { id: true, legalName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        checklist: true,
        _count: { select: { subTasks: true, comments: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return R.paginated(res, tasks, total, Number(page), Number(limit));
}

export async function getTask(req: AuthRequest, res: Response) {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
    include: {
      client: { select: { id: true, legalName: true } },
      assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
      checklist: { orderBy: { order: 'asc' } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { /* no direct user relation on comment, just authorId */ },
      },
      subTasks: {
        include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });

  if (!task) return R.notFound(res, 'Task not found');
  return R.ok(res, task);
}

export async function createTask(req: AuthRequest, res: Response) {
  const task = await prisma.task.create({
    data: {
      ...req.body,
      organisationId: req.user!.orgId,
      creatorId: req.user!.userId,
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      client: { select: { id: true, legalName: true } },
    },
  });

  return R.created(res, task);
}

export async function updateTask(req: AuthRequest, res: Response) {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
  });
  if (!task) return R.notFound(res, 'Task not found');

  const data = { ...req.body };
  if (data.status === 'COMPLETED' && !data.completedAt) {
    data.completedAt = new Date();
  }

  const updated = await prisma.task.update({ where: { id: req.params.id }, data });
  return R.ok(res, updated);
}

export async function deleteTask(req: AuthRequest, res: Response) {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
  });
  if (!task) return R.notFound(res, 'Task not found');

  await prisma.task.delete({ where: { id: req.params.id } });
  return R.noContent(res);
}

export async function updateChecklist(req: AuthRequest, res: Response) {
  const { items } = req.body as { items: { id?: string; text: string; isDone: boolean; order: number }[] };

  await prisma.taskChecklist.deleteMany({ where: { taskId: req.params.id } });

  const created = await prisma.taskChecklist.createMany({
    data: items.map((item) => ({
      taskId: req.params.id,
      text: item.text,
      isDone: item.isDone,
      order: item.order,
    })),
  });

  return R.ok(res, created);
}

export async function addComment(req: AuthRequest, res: Response) {
  const comment = await prisma.taskComment.create({
    data: {
      taskId: req.params.id,
      authorId: req.user!.userId,
      content: req.body.content,
    },
  });

  return R.created(res, comment);
}

export async function getKanbanBoard(req: AuthRequest, res: Response) {
  const { clientId } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {
    organisationId: req.user!.orgId,
    parentTaskId: null,
    ...(clientId && { clientId }),
  };

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      client: { select: { id: true, legalName: true } },
      assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      checklist: true,
    },
  });

  const board = {
    TODO: tasks.filter((t) => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS'),
    REVIEW: tasks.filter((t) => t.status === 'REVIEW'),
    COMPLETED: tasks.filter((t) => t.status === 'COMPLETED'),
    OVERDUE: tasks.filter((t) => t.status === 'OVERDUE'),
  };

  return R.ok(res, board);
}
