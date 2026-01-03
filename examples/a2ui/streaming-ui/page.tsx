/**
 * Streaming UI Example
 *
 * This example demonstrates progressive UI rendering via Server-Sent Events (SSE).
 * Components are streamed and rendered as they become available.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { A2UIStreamingRenderer } from '@lsi/a2ui';
import type { A2UIResponse, A2UIUpdate } from '@lsi/protocol';

// Simulated streaming endpoint
async function* streamMockUI(input: string, sessionId: string): AsyncGenerator<A2UIUpdate> {
  const lowerInput = input.toLowerCase();

  // Initial encoding update
  yield {
    type: 'data',
    data: { status: 'encoding', message: 'Analyzing your request...' }
  };

  await delay(300);

  // Requirements update
  yield {
    type: 'data',
    data: { status: 'requirements', message: 'Determining UI requirements...' }
  };

  await delay(300);

  // Stream components progressively
  if (lowerInput.includes('dashboard')) {
    yield {
      type: 'component',
      componentId: 'header',
      data: {
        type: 'text',
        id: 'header',
        props: { content: 'Dashboard', variant: 'h1' }
      },
      index: 0,
      total: 4
    };

    await delay(200);

    yield {
      type: 'component',
      componentId: 'stats-1',
      data: {
        type: 'card',
        id: 'stats-1',
        props: { title: 'Users', subtitle: '1,234 active' }
      },
      index: 1,
      total: 4
    };

    await delay(200);

    yield {
      type: 'component',
      componentId: 'stats-2',
      data: {
        type: 'card',
        id: 'stats-2',
        props: { title: 'Revenue', subtitle: '$45,678' }
      },
      index: 2,
      total: 4
    };

    await delay(200);

    yield {
      type: 'component',
      componentId: 'refresh',
      data: {
        type: 'button',
        id: 'refresh',
        props: { label: 'Refresh', variant: 'secondary' }
      },
      index: 3,
      total: 4
    };
  } else if (lowerInput.includes('form')) {
    yield {
      type: 'component',
      componentId: 'title',
      data: {
        type: 'text',
        id: 'title',
        props: { content: 'Contact Form', variant: 'h2' }
      },
      index: 0,
      total: 4
    };

    await delay(200);

    yield {
      type: 'component',
      componentId: 'name',
      data: {
        type: 'input',
        id: 'name',
        props: { type: 'text', placeholder: 'Your Name' }
      },
      index: 1,
      total: 4
    };

    await delay(200);

    yield {
      type: 'component',
      componentId: 'email',
      data: {
        type: 'input',
        id: 'email',
        props: { type: 'email', placeholder: 'Your Email' }
      },
      index: 2,
      total: 4
    };

    await delay(200);

    yield {
      type: 'component',
      componentId: 'submit',
      data: {
        type: 'button',
        id: 'submit',
        props: { label: 'Submit', variant: 'primary' }
      },
      index: 3,
      total: 4
    };
  } else {
    // Default components
    yield {
      type: 'component',
      componentId: 'welcome',
      data: {
        type: 'text',
        id: 'welcome',
        props: { content: 'Welcome to Streaming UI Demo', variant: 'h2' }
      },
      index: 0,
      total: 2
    };

    await delay(200);

    yield {
      type: 'component',
      componentId: 'button',
      data: {
        type: 'button',
        id: 'button',
        props: { label: 'Get Started', variant: 'primary' }
      },
      index: 1,
      total: 2
    };
  }

  await delay(200);

  // Done
  yield {
    type: 'done',
    done: true,
    index: -1,
    total: -1
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function StreamingUIExample() {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [updates, setUpdates] = useState<A2UIUpdate[]>([]);
  const [sessionId] = useState(() => `stream-${Date.now()}`);

  const handleStream = async () => {
    if (!input.trim()) return;

    setStreaming(true);
    setUpdates([]);

    try {
      for await (const update of streamMockUI(input, sessionId)) {
        setUpdates(prev => [...prev, update]);
      }
    } catch (error) {
      console.error('Streaming error:', error);
    } finally {
      setStreaming(false);
    }
  };

  // Build initial response from first component update
  const initialResponse: A2UIResponse = React.useMemo(() => {
    const firstComponent = updates.find(u => u.type === 'component')?.data;
    return {
      version: '0.8',
      surface: 'main',
      components: firstComponent ? [firstComponent as any] : [],
      layout: { type: 'vertical', spacing: 16 },
      metadata: {
        timestamp: new Date(),
        sessionId,
        agentId: 'streaming-ui-agent',
        generationTime: Date.now()
      }
    };
  }, [updates, sessionId]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          A2UI Streaming Demo
        </h1>
        <p style={{ color: '#6b7280', marginBottom: 16 }}>
          Watch UI components stream in progressively
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleStream()}
            placeholder="Describe the UI you want..."
            disabled={streaming}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14
            }}
          />
          <button
            onClick={handleStream}
            disabled={streaming || !input.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: streaming ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 500,
              cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {streaming ? 'Streaming...' : 'Start Stream'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setInput('Show me a dashboard')}
            disabled={streaming}
            style={{
              padding: '6px 12px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: 12,
              cursor: streaming ? 'not-allowed' : 'pointer'
            }}
          >
            Dashboard
          </button>
          <button
            onClick={() => setInput('Create a contact form')}
            disabled={streaming}
            style={{
              padding: '6px 12px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: 12,
              cursor: streaming ? 'not-allowed' : 'pointer'
            }}
          >
            Contact Form
          </button>
        </div>
      </div>

      {/* Stream status */}
      {streaming && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            backgroundColor: '#eff6ff',
            border: '1px solid #3b82f6',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              animation: 'pulse 1s infinite'
            }}
          />
          <span style={{ fontSize: 14 }}>
            Streaming updates... ({updates.filter(u => u.type === 'component').length} components)
          </span>
        </div>
      )}

      {/* Update log */}
      {updates.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontFamily: 'monospace',
            fontSize: 12
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Stream Log:</div>
          {updates.slice(-5).map((update, index) => (
            <div key={index} style={{ color: '#6b7280' }}>
              [{update.type}] {update.componentId || update.data?.status || ''}
            </div>
          ))}
        </div>
      )}

      {/* Rendered UI */}
      {updates.length > 0 && (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            backgroundColor: '#f9fafb'
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Live Preview</h3>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 16,
              backgroundColor: 'white',
              minHeight: 200
            }}
          >
            <A2UIStreamingRenderer
              initialResponse={initialResponse}
              streaming={true}
              customComponents={{
                text: ({ content, variant }: any) => {
                  const Tag = variant?.startsWith('h') ? variant : 'p';
                  return <Tag>{content}</Tag>;
                },
                input: ({ placeholder, type }: any) => (
                  <input
                    type={type || 'text'}
                    placeholder={placeholder}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      marginBottom: 8
                    }}
                  />
                ),
                button: ({ label, variant }: any) => (
                  <button
                    style={{
                      padding: '8px 16px',
                      backgroundColor: variant === 'primary' ? '#3b82f6' : '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6
                    }}
                  >
                    {label}
                  </button>
                ),
                card: ({ title, subtitle }: any) => (
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 8
                    }}
                  >
                    {title && <div style={{ fontWeight: 600 }}>{title}</div>}
                    {subtitle && <div style={{ color: '#6b7280', fontSize: 14 }}>{subtitle}</div>}
                  </div>
                )
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
