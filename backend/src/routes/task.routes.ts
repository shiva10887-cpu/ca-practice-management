import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers/task.controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listTasks);
router.get('/kanban', ctrl.getKanbanBoard);
router.get('/:id', ctrl.getTask);
router.post('/', ctrl.createTask);
router.put('/:id', ctrl.updateTask);
router.delete('/:id', ctrl.deleteTask);
router.put('/:id/checklist', ctrl.updateChecklist);
router.post('/:id/comments', ctrl.addComment);

export default router;
