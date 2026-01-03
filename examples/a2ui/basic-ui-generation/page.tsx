/**
 * Basic UI Generation Example
 *
 * This example demonstrates generating UI from natural language input
 * using the A2UI protocol.
 */

'use client';

import React, { useState } from 'react';
import { A2UIRenderer } from '@lsi/a2ui';
import type { A2UIResponse, A2UIAction } from '@lsi/protocol';

// Mock agent for demonstration
// In production, this would use the real A2UIAgent
async function generateMockUI(input: string, sessionId: string): Promise<A2UIResponse> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const lowerInput = input.toLowerCase();

  // Generate different UI based on input
  if (lowerInput.includes('login') || lowerInput.includes('sign in')) {
    return {
      version: '0.8',
      surface: 'main',
      components: [
        {
          type: 'container',
          id: 'login-container',
          layout: {
            type: 'vertical',
            spacing: 16
          },
          children: [
            {
              type: 'text',
              id: 'title',
              props: {
                content: 'Welcome Back',
                variant: 'h2'
              }
            },
            {
              type: 'input',
              id: 'email',
              props: {
                type: 'email',
                placeholder: 'Email address',
                required: true
              }
            },
            {
              type: 'input',
              id: 'password',
              props: {
                type: 'password',
                placeholder: 'Password',
                required: true
              }
            },
            {
              type: 'button',
              id: 'submit',
              props: {
                label: 'Sign In',
                variant: 'primary'
              },
              events: [
                { name: 'click', handler: 'handleLogin' }
              ]
            }
          ]
        }
      ],
      layout: {
        type: 'vertical',
        spacing: 16,
        padding: 24
      },
      actions: [
        {
          id: 'login',
          type: 'submit',
          handler: 'handleLogin'
        }
      ],
      metadata: {
        timestamp: new Date(),
        sessionId,
        agentId: 'basic-ui-agent',
        generationTime: 500,
        confidence: 0.95
      }
    };
  }

  if (lowerInput.includes('dashboard') || lowerInput.includes('stats')) {
    return {
      version: '0.8',
      surface: 'main',
      components: [
        {
          type: 'container',
          id: 'dashboard-container',
          children: [
            {
              type: 'text',
              id: 'title',
              props: {
                content: 'Dashboard',
                variant: 'h1'
              }
            },
            {
              type: 'card',
              id: 'stats-card',
              props: {
                title: 'Statistics',
                subtitle: 'Overview of your data'
              },
              children: [
                {
                  type: 'text',
                  id: 'stat1',
                  props: {
                    content: 'Total Users: 1,234',
                    variant: 'body'
                  }
                },
                {
                  type: 'text',
                  id: 'stat2',
                  props: {
                    content: 'Active Sessions: 56',
                    variant: 'body'
                  }
                }
              ]
            },
            {
              type: 'button',
              id: 'refresh',
              props: {
                label: 'Refresh Data',
                variant: 'secondary'
              }
            }
          ]
        }
      ],
      layout: {
        type: 'grid',
        columns: 2,
        spacing: 16
      },
      metadata: {
        timestamp: new Date(),
        sessionId,
        agentId: 'basic-ui-agent',
        generationTime: 500,
        confidence: 0.9
      }
    };
  }

  if (lowerInput.includes('form') || lowerInput.includes('contact')) {
    return {
      version: '0.8',
      surface: 'main',
      components: [
        {
          type: 'form',
          id: 'contact-form',
          props: {
            id: 'contact'
          },
          children: [
            {
              type: 'text',
              id: 'form-title',
              props: {
                content: 'Contact Us',
                variant: 'h2'
              }
            },
            {
              type: 'input',
              id: 'name',
              props: {
                type: 'text',
                placeholder: 'Your Name',
                required: true
              }
            },
            {
              type: 'input',
              id: 'email',
              props: {
                type: 'email',
                placeholder: 'Your Email',
                required: true
              }
            },
            {
              type: 'textarea',
              id: 'message',
              props: {
                placeholder: 'Your Message',
                rows: 5,
                required: true
              }
            },
            {
              type: 'button',
              id: 'submit',
              props: {
                label: 'Send Message',
                variant: 'primary'
              }
            }
          ]
        }
      ],
      layout: {
        type: 'vertical',
        spacing: 16
      },
      metadata: {
        timestamp: new Date(),
        sessionId,
        agentId: 'basic-ui-agent',
        generationTime: 500,
        confidence: 0.92
      }
    };
  }

  // Default response
  return {
    version: '0.8',
    surface: 'main',
    components: [
      {
        type: 'container',
        id: 'default-container',
        children: [
          {
            type: 'text',
            id: 'greeting',
            props: {
              content: 'Hello! Try asking for a login form, dashboard, or contact form.',
              variant: 'body'
            }
          },
          {
            type: 'button',
            id: 'example-btn',
            props: {
              label: 'Show Examples',
              variant: 'secondary'
            }
          }
        ]
      }
    ],
    layout: {
      type: 'vertical',
      spacing: 16
    },
    metadata: {
      timestamp: new Date(),
      sessionId,
      agentId: 'basic-ui-agent',
      generationTime: 500,
      confidence: 0.8
    }
  };
}

export default function BasicUIExample() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<A2UIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  const handleGenerate = async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      const uiResponse = await generateMockUI(input, sessionId);
      setResponse(uiResponse);
    } catch (error) {
      console.error('Error generating UI:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: A2UIAction) => {
    console.log('Action triggered:', action);
    alert(`Action: ${action.type} (${action.id})`);
  };

  const examples = [
    'Create a login form',
    'Show me a dashboard',
    'Build a contact form',
    'I need a product catalog'
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          A2UI Basic Generation
        </h1>
        <p style={{ color: '#6b7280', marginBottom: 16 }}>
          Generate UI from natural language input
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="Describe the UI you want..."
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !input.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 500,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.6 : 1
            }}
          >
            {loading ? 'Generating...' : 'Generate UI'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Try:</span>
          {examples.map((example) => (
            <button
              key={example}
              onClick={() => setInput(example)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {response && (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            backgroundColor: '#f9fafb'
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Generated UI
            </h3>
            {response.metadata && (
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Confidence: {(response.metadata.confidence! * 100).toFixed(0)}% |
                Components: {response.components.length} |
                Generated in: {response.metadata.generationTime}ms
              </div>
            )}
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 16,
              backgroundColor: 'white'
            }}
          >
            <A2UIRenderer
              response={response}
              onAction={handleAction}
              customComponents={{
                // Provide minimal implementations for demo
                container: ({ children, style }: any) => (
                  <div style={style}>{children}</div>
                ),
                text: ({ content, variant, style }: any) => {
                  const Tag = variant?.startsWith('h') ? variant : 'p';
                  return <Tag style={style}>{content}</Tag>;
                },
                input: ({ placeholder, type, style }: any) => (
                  <input
                    type={type || 'text'}
                    placeholder={placeholder}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      boxSizing: 'border-box',
                      ...style
                    }}
                  />
                ),
                textarea: ({ placeholder, rows, style }: any) => (
                  <textarea
                    placeholder={placeholder}
                    rows={rows || 4}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      boxSizing: 'border-box',
                      ...style
                    }}
                  />
                ),
                button: ({ label, variant, onClick, style }: any) => (
                  <button
                    onClick={onClick}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: variant === 'primary' ? '#3b82f6' : '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 500,
                      cursor: 'pointer',
                      ...style
                    }}
                  >
                    {label}
                  </button>
                ),
                card: ({ title, subtitle, children, style }: any) => (
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: 16,
                      ...style
                    }}
                  >
                    {title && <h3 style={{ margin: '0 0 4px 0' }}>{title}</h3>}
                    {subtitle && <p style={{ margin: '0 0 12px 0', color: '#6b7280' }}>{subtitle}</p>}
                    {children}
                  </div>
                ),
                form: ({ children, style }: any) => (
                  <form style={style} onSubmit={(e) => e.preventDefault()}>
                    {children}
                  </form>
                )
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
