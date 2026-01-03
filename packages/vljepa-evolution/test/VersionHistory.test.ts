/**
 * VersionHistory Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VersionHistory } from '../src/history/VersionHistory.js';
import type { UIVersion, UIState } from '../src/types.js';

describe('VersionHistory', () => {
  let history: VersionHistory;
  let mockVersion: UIVersion;
  let mockState: UIState;

  beforeEach(() => {
    history = new VersionHistory();

    mockState = {
      components: [
        {
          id: 'comp1',
          type: 'button',
          props: { label: 'Click' },
          children: [],
          styles: {}
        }
      ],
      styles: {
        css: { color: 'blue' },
        theme: 'dark',
        variables: {}
      },
      layout: {
        type: 'flex',
        dimensions: { width: 100 },
        position: {},
        children: []
      },
      behavior: {
        events: [],
        actions: []
      },
      metadata: {
        version: '1.0.0',
        timestamp: Date.now(),
        hash: 'abc123',
        author: 'test'
      }
    };

    mockVersion = {
      id: 'ver1',
      version: '1.0.0',
      hash: 'abc123',
      parent: null,
      branch: 'main',
      timestamp: Date.now(),
      author: 'test',
      message: 'Initial commit',
      changes: [],
      state: mockState
    };
  });

  describe('initialization', () => {
    it('should create empty history', () => {
      const emptyHistory = new VersionHistory();
      expect(emptyHistory).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize with root version', () => {
      history.initialize(mockVersion);

      expect(history.getCurrentVersion()?.id).toBe('ver1');
    });

    it('should set root version', () => {
      history.initialize(mockVersion);

      expect(history['tree'].root).toBe('ver1');
    });

    it('should set main branch head', () => {
      history.initialize(mockVersion);

      const mainHead = history.getBranchHead('main');
      expect(mainHead?.id).toBe('ver1');
    });
  });

  describe('addVersion', () => {
    it('should add version to tree', () => {
      history.initialize(mockVersion);

      const newVersion: UIVersion = {
        ...mockVersion,
        id: 'ver2',
        version: '1.0.1',
        parent: 'ver1',
        message: 'Change'
      };

      history.addVersion(newVersion);

      expect(history.getVersion('ver2')).toBeDefined();
    });

    it('should update branch head', () => {
      history.initialize(mockVersion);

      const newVersion: UIVersion = {
        ...mockVersion,
        id: 'ver2',
        version: '1.0.1',
        parent: 'ver1',
        message: 'Change'
      };

      history.addVersion(newVersion);

      expect(history.getBranchHead('main')?.id).toBe('ver2');
    });

    it('should create new branch if needed', () => {
      history.initialize(mockVersion);

      const newVersion: UIVersion = {
        ...mockVersion,
        id: 'ver2',
        version: '1.0.0',
        parent: null,
        branch: 'feature',
        message: 'Feature branch'
      };

      history.addVersion(newVersion);

      expect(history.getBranches()).toContain('feature');
      expect(history.getBranchHead('feature')?.id).toBe('ver2');
    });

    it('should throw error for non-existent parent', () => {
      history.initialize(mockVersion);

      const invalidVersion: UIVersion = {
        ...mockVersion,
        id: 'ver2',
        version: '1.0.1',
        parent: 'nonexistent',
        message: 'Invalid'
      };

      expect(() => history.addVersion(invalidVersion)).toThrow();
    });
  });

  describe('getVersion', () => {
    it('should return version by ID', () => {
      history.initialize(mockVersion);

      const version = history.getVersion('ver1');
      expect(version?.id).toBe('ver1');
    });

    it('should return undefined for non-existent version', () => {
      const version = history.getVersion('nonexistent');
      expect(version).toBeUndefined();
    });
  });

  describe('getBranchHead', () => {
    it('should return head of branch', () => {
      history.initialize(mockVersion);

      const head = history.getBranchHead('main');
      expect(head?.id).toBe('ver1');
    });

    it('should return undefined for non-existent branch', () => {
      const head = history.getBranchHead('nonexistent');
      expect(head).toBeUndefined();
    });
  });

  describe('getCurrentVersion', () => {
    it('should return current branch version', () => {
      history.initialize(mockVersion);

      const current = history.getCurrentVersion();
      expect(current?.id).toBe('ver1');
    });
  });

  describe('createBranch', () => {
    it('should create new branch', () => {
      history.initialize(mockVersion);

      history.createBranch('feature', 'ver1');

      expect(history.getBranches()).toContain('feature');
      expect(history.getBranchHead('feature')?.id).toBe('ver1');
    });

    it('should throw error for existing branch', () => {
      history.initialize(mockVersion);

      expect(() => history.createBranch('main', 'ver1')).toThrow();
    });

    it('should throw error for non-existent version', () => {
      history.initialize(mockVersion);

      expect(() => history.createBranch('feature', 'nonexistent')).toThrow();
    });
  });

  describe('switchBranch', () => {
    it('should switch to existing branch', () => {
      history.initialize(mockVersion);
      history.createBranch('feature', 'ver1');

      history.switchBranch('feature');

      expect(history.getCurrentBranch()).toBe('feature');
    });

    it('should throw error for non-existent branch', () => {
      expect(() => history.switchBranch('nonexistent')).toThrow();
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', () => {
      expect(history.getCurrentBranch()).toBe('main');
    });
  });

  describe('getBranches', () => {
    it('should return all branches', () => {
      history.initialize(mockVersion);
      history.createBranch('feature', 'ver1');
      history.createBranch('bugfix', 'ver1');

      const branches = history.getBranches();

      expect(branches).toContain('main');
      expect(branches).toContain('feature');
      expect(branches).toContain('bugfix');
    });
  });

  describe('deleteBranch', () => {
    it('should delete branch', () => {
      history.initialize(mockVersion);
      history.createBranch('feature', 'ver1');

      const result = history.deleteBranch('feature');

      expect(result).toBe(true);
      expect(history.getBranches()).not.toContain('feature');
    });

    it('should throw error when deleting main', () => {
      history.initialize(mockVersion);

      expect(() => history.deleteBranch('main')).toThrow();
    });

    it('should throw error when deleting current branch', () => {
      history.initialize(mockVersion);

      expect(() => history.deleteBranch('main')).toThrow();
    });

    it('should return false for non-existent branch', () => {
      const result = history.deleteBranch('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getAncestry', () => {
    it('should get version ancestry', () => {
      history.initialize(mockVersion);

      const v2: UIVersion = { ...mockVersion, id: 'v2', version: '1.0.1', parent: 'ver1', message: '' };
      const v3: UIVersion = { ...mockVersion, id: 'v3', version: '1.0.2', parent: 'v2', message: '' };

      history.addVersion(v2);
      history.addVersion(v3);

      const ancestry = history.getAncestry('v3');

      expect(ancestry).toHaveLength(3);
      expect(ancestry[0].id).toBe('ver1');
      expect(ancestry[1].id).toBe('v2');
      expect(ancestry[2].id).toBe('v3');
    });

    it('should return single version for root', () => {
      history.initialize(mockVersion);

      const ancestry = history.getAncestry('ver1');

      expect(ancestry).toHaveLength(1);
    });
  });

  describe('getDescendants', () => {
    it('should get version descendants', () => {
      history.initialize(mockVersion);

      const v2: UIVersion = { ...mockVersion, id: 'v2', version: '1.0.1', parent: 'ver1', message: '' };
      const v3: UIVersion = { ...mockVersion, id: 'v3', version: '1.1.0', parent: 'ver1', message: '' };
      const v4: UIVersion = { ...mockVersion, id: 'v4', version: '1.0.2', parent: 'v2', message: '' };

      history.addVersion(v2);
      history.addVersion(v3);
      history.addVersion(v4);

      const descendants = history.getDescendants('ver1');

      expect(descendants.length).toBeGreaterThanOrEqual(2);
      expect(descendants.some(d => d.id === 'v2')).toBe(true);
      expect(descendants.some(d => d.id === 'v3')).toBe(true);
    });
  });

  describe('merge', () => {
    it('should merge two branches', async () => {
      history.initialize(mockVersion);
      history.createBranch('feature', 'ver1');

      const v2: UIVersion = { ...mockVersion, id: 'v2', version: '1.1.0', parent: 'ver1', branch: 'feature', message: 'Feature' };
      history.addVersion(v2);

      const merge = await history.merge('feature', 'main');

      expect(merge.sourceBranch).toBe('feature');
      expect(merge.targetBranch).toBe('main');
      expect(merge.resolved).toBe(true);
    });

    it('should create merge version', async () => {
      history.initialize(mockVersion);
      history.createBranch('feature', 'ver1');

      const v2: UIVersion = { ...mockVersion, id: 'v2', version: '1.1.0', parent: 'ver1', branch: 'feature', message: 'Feature' };
      history.addVersion(v2);

      const merge = await history.merge('feature', 'main');

      expect(history.getVersion(merge.resultVersion)).toBeDefined();
    });

    it('should detect conflicts', async () => {
      history.initialize(mockVersion);
      history.createBranch('feature', 'ver1');

      const v2: UIVersion = {
        ...mockVersion,
        id: 'v2',
        version: '1.1.0',
        parent: 'ver1',
        branch: 'feature',
        state: { ...mockState, components: [] }
      };

      const v3: UIVersion = {
        ...mockVersion,
        id: 'v3',
        version: '1.0.1',
        parent: 'ver1',
        branch: 'main',
        state: { ...mockState, components: [] }
      };

      history.addVersion(v2);
      history.addVersion(v3);

      const merge = await history.merge('feature', 'main');

      expect(merge.conflicts).toBeDefined();
    });
  });

  describe('getMerges', () => {
    it('should return all merges', async () => {
      history.initialize(mockVersion);
      history.createBranch('feature', 'ver1');

      await history.merge('feature', 'main');

      const merges = history.getMerges();

      expect(merges.length).toBe(1);
    });
  });

  describe('getMergesForBranch', () => {
    it('should return merges for branch', async () => {
      history.initialize(mockVersion);
      history.createBranch('feature', 'ver1');

      await history.merge('feature', 'main');

      const merges = history.getMergesForBranch('main');

      expect(merges.length).toBe(1);
      expect(merges[0].targetBranch).toBe('main');
    });
  });

  describe('getHistoryBetween', () => {
    it('should get history between versions', () => {
      history.initialize(mockVersion);

      const v2: UIVersion = { ...mockVersion, id: 'v2', version: '1.0.1', parent: 'ver1', message: '' };
      const v3: UIVersion = { ...mockVersion, id: 'v3', version: '1.0.2', parent: 'v2', message: '' };

      history.addVersion(v2);
      history.addVersion(v3);

      const between = history.getHistoryBetween('ver1', 'v3');

      expect(between.length).toBeGreaterThanOrEqual(1);
      expect(between[between.length - 1].id).toBe('v3');
    });
  });

  describe('getLog', () => {
    it('should return all versions by default', () => {
      history.initialize(mockVersion);

      const log = history.getLog();

      expect(log.length).toBe(1);
    });

    it('should filter by branch', () => {
      history.initialize(mockVersion);
      history.createBranch('feature', 'ver1');

      const v2: UIVersion = { ...mockVersion, id: 'v2', version: '1.0.0', parent: null, branch: 'feature', message: '' };
      history.addVersion(v2);

      const log = history.getLog({ branch: 'feature' });

      expect(log.every(v => v.branch === 'feature')).toBe(true);
    });

    it('should filter by author', () => {
      history.initialize(mockVersion);

      const v2: UIVersion = { ...mockVersion, id: 'v2', version: '1.0.1', parent: 'ver1', author: 'alice', message: '' };
      history.addVersion(v2);

      const log = history.getLog({ author: 'alice' });

      expect(log.every(v => v.author === 'alice')).toBe(true);
    });

    it('should sort ascending', () => {
      history.initialize(mockVersion);

      const v2: UIVersion = { ...mockVersion, id: 'v2', version: '1.0.1', parent: 'ver1', timestamp: Date.now() + 1000, message: '' };
      history.addVersion(v2);

      const log = history.getLog({ order: 'asc' });

      expect(log[0].timestamp).toBeLessThanOrEqual(log[1].timestamp);
    });

    it('should limit results', () => {
      history.initialize(mockVersion);

      for (let i = 0; i < 10; i++) {
        const v: UIVersion = {
          ...mockVersion,
          id: `v${i}`,
          version: `1.0.${i}`,
          parent: i === 0 ? null : `v${i - 1}`,
          message: ''
        };
        if (i === 0) {
          history.initialize(v);
        } else {
          history.addVersion(v);
        }
      }

      const log = history.getLog({ limit: 5 });

      expect(log.length).toBe(5);
    });
  });

  describe('export/import', () => {
    it('should export tree to JSON', () => {
      history.initialize(mockVersion);

      const exported = history.exportTree();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('root');
      expect(parsed).toHaveProperty('nodes');
    });

    it('should import tree from JSON', () => {
      history.initialize(mockVersion);

      const exported = history.exportTree();

      const newHistory = new VersionHistory();
      newHistory.importTree(exported);

      expect(newHistory.getCurrentVersion()?.id).toBe('ver1');
    });
  });
});
