/**
 * Tests for TaskBoard - CRDT-based multi-agent task coordination
 */
import { describe, it, expect, vi } from 'vitest';
import { TaskBoard } from '../task-board.js';
import { TaskStatus, TaskPriority, CollabEventType } from '../types.js';

describe('TaskBoard', () => {
  it('should create a task with default values', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Fix login bug', 'Login page crashes on submit', TaskPriority.HIGH);
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Fix login bug');
    expect(task.description).toBe('Login page crashes on submit');
    expect(task.priority).toBe(TaskPriority.HIGH);
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.createdBy).toBe('agent-1');
    expect(task.claimedBy).toBeUndefined();
  });

  it('should create a task with tags and dependencies', () => {
    const board = new TaskBoard('agent-1');
    const dep = board.createTask('Setup DB', 'Create database schema', TaskPriority.MEDIUM);
    const task = board.createTask('Build API', 'Create REST endpoints', TaskPriority.HIGH, {
      tags: ['backend', 'api'],
      dependencies: [dep.id],
    });
    expect(task.tags).toEqual(['backend', 'api']);
    expect(task.dependencies).toEqual([dep.id]);
  });

  it('should claim a pending task', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    const claimed = board.claimTask(task.id, 'agent-2');
    expect(claimed).not.toBeNull();
    expect(claimed!.status).toBe(TaskStatus.CLAIMED);
    expect(claimed!.claimedBy).toBe('agent-2');
  });

  it('should not claim an already claimed task by different agent', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    board.claimTask(task.id, 'agent-2');
    const result = board.claimTask(task.id, 'agent-3');
    expect(result).toBeNull();
  });

  it('should allow the same agent to re-claim', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    board.claimTask(task.id, 'agent-2');
    const result = board.claimTask(task.id, 'agent-2');
    expect(result).not.toBeNull();
  });

  it('should start a claimed task', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    board.claimTask(task.id, 'agent-2');
    const started = board.startTask(task.id, 'agent-2');
    expect(started).not.toBeNull();
    expect(started!.status).toBe(TaskStatus.IN_PROGRESS);
  });

  it('should not start an unclaimed task', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    const result = board.startTask(task.id, 'agent-2');
    expect(result).toBeNull();
  });

  it('should complete a task', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    board.claimTask(task.id, 'agent-2');
    board.startTask(task.id, 'agent-2');
    const completed = board.completeTask(task.id, 'agent-2', 'Done!');
    expect(completed).not.toBeNull();
    expect(completed!.status).toBe(TaskStatus.COMPLETED);
    expect(completed!.completedBy).toBe('agent-2');
    expect(completed!.metadata.result).toBe('Done!');
  });

  it('should not complete an unclaimed task', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    const result = board.completeTask(task.id, 'agent-2');
    expect(result).toBeNull();
  });

  it('should not complete a completed task again', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    board.claimTask(task.id, 'agent-2');
    board.completeTask(task.id, 'agent-2');
    const result = board.completeTask(task.id, 'agent-2');
    expect(result).toBeNull();
  });

  it('should fail a task', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    board.claimTask(task.id, 'agent-2');
    const failed = board.failTask(task.id, 'agent-2', 'API timeout');
    expect(failed).not.toBeNull();
    expect(failed!.status).toBe(TaskStatus.FAILED);
    expect(failed!.metadata.failReason).toBe('API timeout');
  });

  it('should cancel a task', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    const cancelled = board.cancelTask(task.id, 'agent-1');
    expect(cancelled).not.toBeNull();
    expect(cancelled!.status).toBe(TaskStatus.CANCELLED);
  });

  it('should not cancel a completed task', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    board.claimTask(task.id, 'agent-2');
    board.completeTask(task.id, 'agent-2');
    const result = board.cancelTask(task.id, 'agent-1');
    expect(result).toBeNull();
  });

  it('should get a task by ID', () => {
    const board = new TaskBoard('agent-1');
    const task = board.createTask('Task 1', 'Description', TaskPriority.LOW);
    const retrieved = board.getTask(task.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe('Task 1');
  });

  it('should return null for non-existent task', () => {
    const board = new TaskBoard('agent-1');
    expect(board.getTask('nonexistent')).toBeNull();
  });

  it('should list all tasks', () => {
    const board = new TaskBoard('agent-1');
    board.createTask('Task 1', 'Desc 1', TaskPriority.LOW);
    board.createTask('Task 2', 'Desc 2', TaskPriority.HIGH);
    expect(board.getAllTasks().length).toBe(2);
  });

  it('should filter tasks by status', () => {
    const board = new TaskBoard('agent-1');
    const t1 = board.createTask('Task 1', 'Desc 1', TaskPriority.LOW);
    const t2 = board.createTask('Task 2', 'Desc 2', TaskPriority.HIGH);
    board.claimTask(t1.id, 'agent-2');
    board.completeTask(t1.id, 'agent-2');
    const pending = board.getTasksByStatus(TaskStatus.PENDING);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(t2.id);
  });

  it('should filter tasks by priority', () => {
    const board = new TaskBoard('agent-1');
    board.createTask('Task 1', 'Desc 1', TaskPriority.LOW);
    board.createTask('Task 2', 'Desc 2', TaskPriority.HIGH);
    board.createTask('Task 3', 'Desc 3', TaskPriority.HIGH);
    const high = board.getTasksByPriority(TaskPriority.HIGH);
    expect(high.length).toBe(2);
  });

  it('should filter tasks by agent', () => {
    const board = new TaskBoard('agent-1');
    const t1 = board.createTask('Task 1', 'Desc 1', TaskPriority.LOW);
    const t2 = board.createTask('Task 2', 'Desc 2', TaskPriority.LOW);
    board.claimTask(t1.id, 'agent-2');
    board.claimTask(t2.id, 'agent-3');
    const agent2Tasks = board.getTasksByAgent('agent-2');
    expect(agent2Tasks.length).toBe(1);
    expect(agent2Tasks[0].id).toBe(t1.id);
  });

  it('should get available tasks respecting dependencies', () => {
    const board = new TaskBoard('agent-1');
    const dep = board.createTask('Dep', 'Dependency', TaskPriority.MEDIUM);
    const task = board.createTask('Main', 'Main task', TaskPriority.HIGH, { dependencies: [dep.id] });
    // dep not completed, so Main should not be available
    expect(board.getAvailableTasks().length).toBe(1); // only dep itself
    expect(board.getAvailableTasks().find(t => t.id === task.id)).toBeUndefined();

    // Complete dep
    board.claimTask(dep.id, 'agent-1');
    board.completeTask(dep.id, 'agent-1');
    // Now Main should be available
    expect(board.getAvailableTasks().find(t => t.id === task.id)).toBeDefined();
  });

  it('should emit events on task creation', () => {
    const board = new TaskBoard('agent-1');
    const listener = vi.fn();
    board.on(listener);
    board.createTask('Task 1', 'Desc', TaskPriority.LOW);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe(CollabEventType.TASK_CREATED);
  });

  it('should emit events on task claim and completion', () => {
    const board = new TaskBoard('agent-1');
    const listener = vi.fn();
    board.on(listener);
    const task = board.createTask('Task 1', 'Desc', TaskPriority.LOW);
    board.claimTask(task.id, 'agent-2');
    board.completeTask(task.id, 'agent-2');
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls[1][0].type).toBe(CollabEventType.TASK_CLAIMED);
    expect(listener.mock.calls[2][0].type).toBe(CollabEventType.TASK_COMPLETED);
  });

  it('should merge two task boards', () => {
    const board1 = new TaskBoard('agent-1');
    const board2 = new TaskBoard('agent-2');

    const t1 = board1.createTask('Task A', 'From agent-1', TaskPriority.LOW);
    const t2 = board2.createTask('Task B', 'From agent-2', TaskPriority.HIGH);

    board1.merge(board2);
    expect(board1.getTask(t1.id)).not.toBeNull();
    expect(board1.getTask(t2.id)).not.toBeNull();
    expect(board1.getAllTasks().length).toBe(2);
  });

  it('should export and import state', () => {
    const board = new TaskBoard('agent-1');
    board.createTask('Task 1', 'Desc', TaskPriority.LOW);
    board.createTask('Task 2', 'Desc', TaskPriority.HIGH);
    const state = board.exportState();

    const board2 = new TaskBoard('agent-2');
    board2.importState(state);
    expect(board2.getAllTasks().length).toBe(2);
  });
});
