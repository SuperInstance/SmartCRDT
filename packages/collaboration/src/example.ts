/**
 * @file example.ts - Usage examples for collaboration package
 * @description Demonstrates how to use presence, cursors, and UI components
 * @module @lsi/collaboration/example
 */

import {
  PresenceManager,
  CursorTracker,
  UI,
  UserStatus,
  PresenceEventType,
  ColorStrategy
} from './index.js';

/**
 * Example 1: Basic Presence Setup
 *
 * Demonstrates basic presence manager setup and event handling
 */
export function example1_basicPresence() {
  console.log('=== Example 1: Basic Presence ===\n');

  // Create presence manager for current user
  const presence = new PresenceManager({
    userId: 'user-alice',
    userName: 'Alice',
    config: {
      timeouts: {
        idleTimeout: 2 * 60 * 1000,  // 2 minutes
        offlineTimeout: 5 * 60 * 1000, // 5 minutes
        typingTimeout: 3 * 1000        // 3 seconds
      },
      enableCursors: true,
      enableTyping: true
    }
  });

  // Subscribe to presence events
  const unsubscribe = presence.onPresenceChange((event) => {
    console.log(`[Presence Event] ${event.type}:`, event.presence.userName);
  });

  // Update cursor position
  presence.updateCursor({ line: 10, column: 25 });

  // Start typing
  presence.startTyping();

  // Set document context
  presence.setDocument('document-123');

  // Get current user info
  const currentUser = presence.getUser('user-alice');
  console.log('Current user:', currentUser);

  // Cleanup
  unsubscribe();
  presence.destroy();
}

/**
 * Example 2: Multi-User Collaboration
 *
 * Demonstrates tracking multiple users and their presence
 */
export function example2_multiUserCollaboration() {
  console.log('\n=== Example 2: Multi-User Collaboration ===\n');

  // Create presence manager for Alice
  const alicePresence = new PresenceManager({
    userId: 'user-alice',
    userName: 'Alice'
  });

  // Simulate remote users joining
  const bobPresence = {
    userId: 'user-bob',
    userName: 'Bob',
    status: UserStatus.ONLINE,
    documentId: 'doc-shared',
    cursor: {
      userId: 'user-bob',
      userName: 'Bob',
      position: { line: 5, column: 10 },
      color: '#4ECDC4',
      timestamp: Date.now()
    },
    typing: {
      isTyping: true,
      startTime: Date.now()
    },
    lastActivity: Date.now()
  };

  const charliePresence = {
    userId: 'user-charlie',
    userName: 'Charlie',
    status: UserStatus.ONLINE,
    documentId: 'doc-shared',
    cursor: {
      userId: 'user-charlie',
      userName: 'Charlie',
      position: { line: 15, column: 20 },
      color: '#FF6B6B',
      timestamp: Date.now()
    },
    lastActivity: Date.now()
  };

  // Add remote users
  alicePresence.updateRemoteUser(bobPresence);
  alicePresence.updateRemoteUser(charliePresence);

  // Get all users in the document
  const docUsers = alicePresence.getUsersInDocument('doc-shared');
  console.log('Users in document:', docUsers.map(u => u.userName));

  // Get typing users
  const typingUsers = alicePresence.getTypingUsers('doc-shared');
  console.log('Typing users:', typingUsers.map(u => u.userName));

  // Get statistics
  const stats = alicePresence.getStats();
  console.log('Stats:', stats);

  alicePresence.destroy();
}

/**
 * Example 3: Cursor Tracking
 *
 * Demonstrates cursor position tracking and rendering
 */
export function example3_cursorTracking() {
  console.log('\n=== Example 3: Cursor Tracking ===\n');

  // Create cursor tracker
  const tracker = new CursorTracker({
    showLabel: true,
    enableSelection: true
  });

  // Set document metrics for accurate position calculation
  tracker.setDocumentMetrics({
    lineHeight: 24,
    charWidth: 9,
    lineHeightPixels: 24,
    tabSize: 4
  });

  // Simulate user presence with cursors
  const users = [
    {
      userId: 'user-bob',
      userName: 'Bob',
      status: UserStatus.ONLINE,
      cursor: {
        userId: 'user-bob',
        userName: 'Bob',
        position: { line: 10, column: 25 },
        color: '#4ECDC4',
        timestamp: Date.now()
      },
      lastActivity: Date.now()
    },
    {
      userId: 'user-charlie',
      userName: 'Charlie',
      status: UserStatus.ONLINE,
      cursor: {
        userId: 'user-charlie',
        userName: 'Charlie',
        position: { line: 10, column: 30 },
        selection: {
          start: { line: 10, column: 30 },
          end: { line: 12, column: 5 }
        },
        color: '#FF6B6B',
        timestamp: Date.now()
      },
      lastActivity: Date.now()
    }
  ];

  // Update cursor tracking
  tracker.updateCursors(users);

  // Get cursors on a specific line
  const line10Cursors = tracker.getCursorsOnLine(10);
  console.log('Cursors on line 10:', line10Cursors.map(c => c.userName));

  // Get render data for UI
  const renderData = tracker.getRenderData();
  console.log('Render data:', renderData.length, 'cursors');

  tracker.destroy();
}

/**
 * Example 4: UI Components
 *
 * Demonstrates rendering collaboration UI
 */
export function example4_uiComponents() {
  console.log('\n=== Example 4: UI Components ===\n');

  // Generate presence list HTML
  const presenceListHTML = UI.renderPresenceList({
    users: [
      {
        userId: 'user-alice',
        userName: 'Alice',
        status: UserStatus.ONLINE,
        documentId: 'doc-1',
        typing: { isTyping: true, startTime: Date.now() },
        lastActivity: Date.now()
      },
      {
        userId: 'user-bob',
        userName: 'Bob',
        status: UserStatus.ONLINE,
        documentId: 'doc-1',
        lastActivity: Date.now()
      },
      {
        userId: 'user-charlie',
        userName: 'Charlie',
        status: UserStatus.IDLE,
        documentId: 'doc-2',
        lastActivity: Date.now() - 300000
      }
    ],
    maxUsers: 10,
    showTyping: true
  });

  console.log('Presence list HTML generated');

  // Generate status badge
  const onlineBadge = UI.renderStatusBadge({ status: UserStatus.ONLINE });
  console.log('Online badge generated');

  // Generate stats card
  const statsCard = UI.renderPresenceStatsCard({
    stats: {
      totalUsers: 5,
      onlineCount: 3,
      idleCount: 1,
      typingCount: 2,
      averageActivityTime: 45000,
      mostActiveDocument: 'doc-1'
    }
  });

  console.log('Stats card generated');
}

/**
 * Example 5: Real-time Collaboration Flow
 *
 * Demonstrates a complete collaboration workflow
 */
export async function example5_realtimeCollaboration() {
  console.log('\n=== Example 5: Real-time Collaboration Flow ===\n');

  // Alice creates a session
  const alice = new PresenceManager({
    userId: 'user-alice',
    userName: 'Alice'
  });

  // Alice subscribes to all presence events
  const unsubscribe = alice.onPresenceChange((event) => {
    switch (event.type) {
      case PresenceEventType.USER_JOINED:
        console.log(`🎉 ${event.presence.userName} joined!`);
        break;
      case PresenceEventType.USER_LEFT:
        console.log(`👋 ${event.presence.userName} left`);
        break;
      case PresenceEventType.CURSOR_MOVED:
        console.log(`📍 ${event.presence.userName} moved to line ${event.presence.cursor?.position.line}`);
        break;
      case PresenceEventType.TYPING_CHANGED:
        if (event.presence.typing?.isTyping) {
          console.log(`⌨️  ${event.presence.userName} is typing...`);
        }
        break;
    }
  });

  // Set up cursor tracking
  const tracker = new CursorTracker();

  // Alice starts editing
  alice.setDocument('collaborative-doc');
  alice.updateCursor({ line: 1, column: 0 });
  alice.startTyping();

  // Bob joins
  setTimeout(() => {
    alice.updateRemoteUser({
      userId: 'user-bob',
      userName: 'Bob',
      status: UserStatus.ONLINE,
      documentId: 'collaborative-doc',
      cursor: {
        userId: 'user-bob',
        userName: 'Bob',
        position: { line: 5, column: 10 },
        color: '#4ECDC4',
        timestamp: Date.now()
      },
      lastActivity: Date.now()
    });

    tracker.updateCursors(alice.getUsers());
  }, 100);

  // Bob moves his cursor
  setTimeout(() => {
    alice.updateRemoteUser({
      userId: 'user-bob',
      userName: 'Bob',
      status: UserStatus.ONLINE,
      documentId: 'collaborative-doc',
      cursor: {
        userId: 'user-bob',
        userName: 'Bob',
        position: { line: 8, column: 15 },
        color: '#4ECDC4',
        timestamp: Date.now()
      },
      lastActivity: Date.now()
    });

    tracker.updateCursors(alice.getUsers());
  }, 200);

  // Bob starts typing
  setTimeout(() => {
    const bobUser = alice.getUser('user-bob');
    if (bobUser) {
      bobUser.typing = { isTyping: true, startTime: Date.now() };
    }
  }, 300);

  // Wait a bit then cleanup
  setTimeout(() => {
    console.log('\n📊 Final Stats:', alice.getStats());
    unsubscribe();
    alice.destroy();
    tracker.destroy();
  }, 500);
}

/**
 * Example 6: Integration with WebSockets
 *
 * Demonstrates how to integrate with WebSocket-based sync
 */
export function example6_websocketIntegration() {
  console.log('\n=== Example 6: WebSocket Integration ===\n');

  const presence = new PresenceManager({
    userId: 'user-alice',
    userName: 'Alice'
  });

  // Simulated WebSocket connection
  const ws = {
    send: (data: any) => console.log('WS Send:', JSON.stringify(data).slice(0, 100) + '...'),
    onMessage: null as ((data: any) => void) | null
  };

  // Send local updates to server
  presence.onPresenceChange((event) => {
    if (event.userId === 'user-alice') {
      ws.send({
        type: 'presence_update',
        data: event.presence
      });
    }
  });

  // Handle incoming WebSocket messages
  ws.onMessage = (data: any) => {
    if (data.type === 'presence_update') {
      presence.updateRemoteUser(data.data);
    }
  };

  // Simulate incoming message
  ws.onMessage?.({
    type: 'presence_update',
    data: {
      userId: 'user-bob',
      userName: 'Bob',
      status: UserStatus.ONLINE,
      documentId: 'doc-shared',
      lastActivity: Date.now()
    }
  });

  console.log('Users tracked:', presence.getUsers().map(u => u.userName));

  presence.destroy();
}

/**
 * Example 7: Custom Color Assignment
 *
 * Demonstrates custom color strategies
 */
export function example7_customColors() {
  console.log('\n=== Example 7: Custom Color Assignment ===\n');

  // Custom color palette
  const customPresence = new PresenceManager({
    userId: 'user-1',
    userName: 'User 1',
    config: {
      colorPalette: [
        '#E91E63', // Pink
        '#9C27B0', // Purple
        '#2196F3', // Blue
        '#009688', // Teal
        '#FF9800'  // Orange
      ]
    }
  });

  // Add multiple users - they'll get colors from the custom palette
  for (let i = 2; i <= 5; i++) {
    customPresence.updateRemoteUser({
      userId: `user-${i}`,
      userName: `User ${i}`,
      status: UserStatus.ONLINE,
      lastActivity: Date.now()
    });
  }

  // Show assigned colors
  customPresence.getUsers().forEach(user => {
    console.log(`${user.userName}: ${user.cursor?.color || 'No color'}`);
  });

  customPresence.destroy();
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  example1_basicPresence();
  example2_multiUserCollaboration();
  example3_cursorTracking();
  example4_uiComponents();
  await example5_realtimeCollaboration();
  example6_websocketIntegration();
  example7_customColors();

  console.log('\n✅ All examples completed!\n');
}

// Run examples if this file is executed directly
// Using a safer check that works across environments
// @ts-ignore - process may not be defined in browser
if (typeof globalThis.process !== 'undefined' &&
    // @ts-ignore
    globalThis.process.argv &&
    // @ts-ignore
    import.meta.url === `file://${globalThis.process.argv[1]}`) {
  runAllExamples().catch(console.error);
}
