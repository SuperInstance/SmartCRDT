/**
 * A2UIRenderer Component
 *
 * Renders A2UI components from VL-JEPA actions.
 * Integrates with @lsi/a2ui package for component rendering.
 */

import React, { useMemo } from 'react';
import type { A2UIComponent } from '@lsi/protocol';
import type { VLJEPAAction, PlannedAction } from '../types';

export interface A2UIRendererProps {
  /** VL-JEPA actions to render */
  actions: PlannedAction[];
  /** Current visual state */
  currentState: any;
  /** On action complete callback */
  onActionComplete: (action: PlannedAction) => void;
  /** Whether to stream updates */
  streaming?: boolean;
  /** Animation duration */
  animationDuration?: number;
}

/**
 * Convert VL-JEPA action to A2UI component
 */
function vljepaActionToA2UI(action: VLJEPAAction): A2UIComponent {
  const baseComponent: A2UIComponent = {
    type: 'div',
    props: {
      className: `a2ui-action a2ui-${action.type}`,
      'data-target': action.target,
      'data-confidence': action.confidence.toString(),
    },
  };

  switch (action.type) {
    case 'modify':
      return {
        type: 'div',
        props: {
          ...baseComponent.props,
          style: action.params as Record<string, string>,
        },
        children: [
          {
            type: 'span',
            props: { className: 'a2ui-label' },
            children: [`Modified: ${action.target}`],
          },
        ],
      };

    case 'create':
      return {
        type: 'div',
        props: {
          ...baseComponent.props,
          style: action.params as Record<string, string>,
        },
        children: [
          {
            type: 'span',
            props: { className: 'a2ui-label' },
            children: [`Created: ${action.target}`],
          },
        ],
      };

    case 'delete':
      return {
        type: 'div',
        props: {
          ...baseComponent.props,
          className: `${baseComponent.props.className} a2ui-delete`,
        },
        children: [
          {
            type: 'span',
            props: { className: 'a2ui-label' },
            children: [`Deleted: ${action.target}`],
          },
        ],
      };

    default:
      return baseComponent;
  }
}

/**
 * Render A2UI component as React element
 */
function renderA2UIComponent(component: A2UIComponent, key?: string): React.ReactElement {
  const { type, props = {}, children = [] } = component;

  // Convert children A2UI components to React elements
  const reactChildren = children.map((child, index) =>
    typeof child === 'string'
      ? child
      : renderA2UIComponent(child, `${key}-child-${index}`)
  );

  // Map A2UI component types to HTML elements
  const elementType = (() => {
    switch (type) {
      case 'button':
        return 'button';
      case 'input':
        return 'input';
      case 'text':
        return 'p';
      case 'container':
        return 'div';
      case 'list':
        return 'ul';
      case 'listItem':
        return 'li';
      default:
        return 'div';
    }
  })();

  return React.createElement(
    elementType,
    { ...props, key },
    ...reactChildren
  );
}

/**
 * A2UIRenderer Component
 */
export default function A2UIRenderer({
  actions,
  currentState,
  onActionComplete,
  streaming = false,
  animationDuration = 300,
}: A2UIRendererProps) {
  // Convert VL-JEPA actions to A2UI components
  const a2uiComponents = useMemo(() => {
    return actions.map((action) => ({
      action,
      component: vljepaActionToA2UI({
        type: action.type,
        target: action.target,
        params: action.params,
        confidence: action.confidence,
        reasoning: action.description,
      }),
    }));
  }, [actions]);

  return (
    <div className="a2ui-renderer">
      {a2uiComponents.map(({ action, component }, index) => (
        <div
          key={action.id}
          className={`a2ui-rendered-item ${streaming ? 'streaming' : ''}`}
          style={{
            animationDelay: streaming ? `${index * 50}ms` : undefined,
            animationDuration: `${animationDuration}ms`,
          }}
        >
          {renderA2UIComponent(component, `a2ui-${index}`)}
          {action.status === 'completed' && (
            <span className="a2ui-status a2ui-success">✓</span>
          )}
          {action.status === 'failed' && (
            <span className="a2ui-status a2ui-error">✗</span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Hook to render A2UI from VL-JEPA actions
 */
export function useA2UIRenderer() {
  const renderActions = React.useCallback((actions: PlannedAction[]) => {
    return actions.map((action) => ({
      action,
      component: vljepaActionToA2UI({
        type: action.type,
        target: action.target,
        params: action.params,
        confidence: action.confidence,
        reasoning: action.description,
      }),
    }));
  }, []);

  const validateComponent = React.useCallback((component: A2UIComponent): boolean => {
    // Basic validation
    return !!component.type && typeof component.props === 'object';
  }, []);

  return {
    renderActions,
    validateComponent,
    vljepaActionToA2UI,
  };
}
