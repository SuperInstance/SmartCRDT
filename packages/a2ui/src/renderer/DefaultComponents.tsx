/**
 * Default A2UI Components - React 19 implementations
 *
 * Basic UI components that implement the A2UI component catalog.
 * These components follow shadcn/ui patterns and support React 19 features.
 */

import React, { useOptimistic, useActionState } from "react";
import type { A2UIComponent, ComponentEvent } from "@lsi/protocol";

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

interface ContainerProps {
  id: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const Container: React.FC<ContainerProps> = ({
  id,
  className,
  style,
  children,
}) => {
  return (
    <div id={id} className={className} style={style}>
      {children}
    </div>
  );
};

interface SpacerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export const Spacer: React.FC<SpacerProps> = ({ size = "md" }) => {
  const sizeMap = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  };

  return <div style={{ height: sizeMap[size] }} />;
};

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  label?: string;
  variant?: "solid" | "dashed" | "dotted";
}

export const Divider: React.FC<DividerProps> = ({
  orientation = "horizontal",
  label,
  variant = "solid",
}) => {
  const borderStyle =
    variant === "dashed" ? "dashed" : variant === "dotted" ? "dotted" : "solid";

  if (orientation === "vertical") {
    return (
      <div
        style={{
          width: 1,
          borderLeft: `1px ${borderStyle} #e5e7eb`,
          margin: "0 8px",
        }}
      />
    );
  }

  if (label) {
    return (
      <div style={{ display: "flex", alignItems: "center", margin: "16px 0" }}>
        <div style={{ flex: 1, borderTop: `1px ${borderStyle} #e5e7eb` }} />
        <span style={{ padding: "0 12px", color: "#6b7280", fontSize: 14 }}>
          {label}
        </span>
        <div style={{ flex: 1, borderTop: `1px ${borderStyle} #e5e7eb` }} />
      </div>
    );
  }

  return (
    <div
      style={{ borderTop: `1px ${borderStyle} #e5e7eb`, margin: "16px 0" }}
    />
  );
};

// ============================================================================
// TEXT COMPONENTS
// ============================================================================

interface TextProps {
  content?: string;
  variant?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "body" | "caption";
  align?: "left" | "center" | "right";
  style?: React.CSSProperties;
  className?: string;
}

export const Text: React.FC<TextProps> = ({
  content,
  variant = "body",
  align = "left",
  style,
  className,
}) => {
  const baseStyle: React.CSSProperties = {
    textAlign: align,
    ...style,
  };

  const variantStyles: Record<typeof variant, React.CSSProperties> = {
    h1: { fontSize: 30, fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: 24, fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: 20, fontWeight: 600, lineHeight: 1.4 },
    h4: { fontSize: 18, fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: 16, fontWeight: 600, lineHeight: 1.5 },
    h6: { fontSize: 14, fontWeight: 600, lineHeight: 1.5 },
    body: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
    caption: {
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 1.4,
      color: "#6b7280",
    },
  };

  const combinedStyle = { ...variantStyles[variant], ...baseStyle };

  if (variant.startsWith("h")) {
    const Tag = variant as keyof JSX.IntrinsicElements;
    return (
      <Tag className={className} style={combinedStyle}>
        {content}
      </Tag>
    );
  }

  return (
    <p className={className} style={combinedStyle}>
      {content}
    </p>
  );
};

// ============================================================================
// INPUT COMPONENTS
// ============================================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "link";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void | Promise<void>;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  icon,
  onClick,
  style,
  className,
  ...props
}) => {
  const [isPending, startTransition] = React.useTransition();

  const handleClick = () => {
    if (onClick) {
      startTransition(() => onClick());
    }
  };

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontWeight: 500,
    borderRadius: 6,
    border: "none",
    cursor: disabled || loading || isPending ? "not-allowed" : "pointer",
    opacity: disabled || loading || isPending ? 0.6 : 1,
    transition: "all 0.2s",
  };

  const variantStyles: Record<typeof variant, React.CSSProperties> = {
    primary: {
      backgroundColor: "#3b82f6",
      color: "white",
    },
    secondary: {
      backgroundColor: "#6b7280",
      color: "white",
    },
    danger: {
      backgroundColor: "#ef4444",
      color: "white",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "#374151",
      border: "1px solid #d1d5db",
    },
    link: {
      backgroundColor: "transparent",
      color: "#3b82f6",
      padding: 0,
    },
  };

  const sizeStyles: Record<typeof size, React.CSSProperties> = {
    sm: { padding: "6px 12px", fontSize: 13 },
    md: { padding: "8px 16px", fontSize: 14 },
    lg: { padding: "12px 24px", fontSize: 16 },
  };

  const combinedStyle = {
    ...baseStyle,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  return (
    <button
      className={className}
      style={combinedStyle}
      disabled={disabled || loading || isPending}
      onClick={handleClick}
      {...props}
    >
      {(loading || isPending) && <span>...</span>}
      {icon}
      {label}
    </button>
  );
};

interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  placeholder?: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "url";
  value?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  placeholder,
  type = "text",
  error,
  style,
  className,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: `1px solid ${error ? "#ef4444" : "#d1d5db"}`,
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
  };

  return (
    <div>
      <input
        type={type}
        placeholder={placeholder}
        className={className}
        style={{ ...baseStyle, ...style }}
        {...props}
      />
      {error && <span style={{ color: "#ef4444", fontSize: 12 }}>{error}</span>}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  placeholder?: string;
  value?: string;
  rows?: number;
  minRows?: number;
  maxRows?: number;
}

export const Textarea: React.FC<TextareaProps> = ({
  placeholder,
  rows = 4,
  style,
  className,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
    resize: "vertical",
    minHeight: rows * 24,
  };

  return (
    <textarea
      placeholder={placeholder}
      rows={rows}
      className={className}
      style={{ ...baseStyle, ...style }}
      {...props}
    />
  );
};

interface CheckboxProps {
  checked?: boolean;
  disabled?: boolean;
  label?: string;
  onChange?: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked = false,
  disabled,
  label,
  onChange,
}) => {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      />
      {label && <span style={{ fontSize: 14 }}>{label}</span>}
    </label>
  );
};

interface SwitchProps {
  checked?: boolean;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  onChange?: (checked: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({
  checked = false,
  disabled,
  label,
  size = "md",
  onChange,
}) => {
  const sizeMap = { sm: 16, md: 24, lg: 32 };
  const thumbSize = { sm: 12, md: 18, lg: 24 };

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div
        style={{
          width: sizeMap[size] * 2,
          height: sizeMap[size],
          backgroundColor: checked ? "#3b82f6" : "#d1d5db",
          borderRadius: sizeMap[size],
          position: "relative",
          transition: "background-color 0.2s",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <div
          style={{
            width: thumbSize[size],
            height: thumbSize[size],
            backgroundColor: "white",
            borderRadius: "50%",
            position: "absolute",
            top: (sizeMap[size] - thumbSize[size]) / 2,
            left: checked ? sizeMap[size] + 2 : 2,
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </div>
      {label && <span style={{ fontSize: 14 }}>{label}</span>}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        style={{ display: "none" }}
      />
    </label>
  );
};

interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  marks?: Array<{ value: number; label: string }>;
  onChange?: (value: number) => void;
}

export const Slider: React.FC<SliderProps> = ({
  value = 0,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  marks,
  onChange,
}) => {
  return (
    <div style={{ width: "100%" }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange?.(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      {marks && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          {marks.map(mark => (
            <span key={mark.value} style={{ fontSize: 12, color: "#6b7280" }}>
              {mark.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DISPLAY COMPONENTS
// ============================================================================

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  fit?: "cover" | "contain" | "fill" | "none" | "scale-down";
}

export const Image: React.FC<ImageProps> = ({
  src,
  alt,
  fit = "cover",
  style,
  ...props
}) => {
  return (
    <img
      src={src}
      alt={alt}
      style={{ objectFit: fit, maxWidth: "100%", ...style }}
      {...props}
    />
  );
};

interface CardProps {
  title?: string;
  subtitle?: string;
  variant?: "default" | "outlined" | "elevated";
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  variant = "default",
  children,
  style,
  className,
}) => {
  const variantStyles: Record<typeof variant, React.CSSProperties> = {
    default: { border: "1px solid #e5e7eb", borderRadius: 8 },
    outlined: { border: "2px solid #d1d5db", borderRadius: 8 },
    elevated: {
      border: "none",
      borderRadius: 8,
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    },
  };

  return (
    <div
      className={className}
      style={{ padding: 16, ...variantStyles[variant], ...style }}
    >
      {title && <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>{title}</h3>}
      {subtitle && (
        <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: 14 }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
};

interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  message?: string;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  message,
  children,
  size = "md",
}) => {
  const colors: Record<
    typeof variant,
    { bg: string; border: string; text: string }
  > = {
    info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
    success: { bg: "#f0fdf4", border: "#22c55e", text: "#15803d" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#b45309" },
    error: { bg: "#fef2f2", border: "#ef4444", text: "#b91c1c" },
  };

  const sizeStyles = {
    sm: { padding: 8, fontSize: 13 },
    md: { padding: 12, fontSize: 14 },
    lg: { padding: 16, fontSize: 15 },
  };

  return (
    <div
      style={{
        backgroundColor: colors[variant].bg,
        borderLeft: `4px solid ${colors[variant].border}`,
        borderRadius: 4,
        ...sizeStyles[size],
      }}
    >
      {title && (
        <div
          style={{
            fontWeight: 600,
            marginBottom: 4,
            color: colors[variant].text,
          }}
        >
          {title}
        </div>
      )}
      {message && <div style={{ color: colors[variant].text }}>{message}</div>}
      {children}
    </div>
  );
};

interface BadgeProps {
  content?: string;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  content,
  variant = "default",
  size = "md",
  dot,
  children,
}) => {
  const colors: Record<typeof variant, string> = {
    default: "#6b7280",
    primary: "#3b82f6",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
  };

  const sizeStyles = {
    sm: { padding: "2px 6px", fontSize: 11 },
    md: { padding: "4px 8px", fontSize: 12 },
    lg: { padding: "6px 12px", fontSize: 13 },
  };

  const badgeStyle: React.CSSProperties = {
    backgroundColor: colors[variant],
    color: "white",
    borderRadius: "9999px",
    fontWeight: 500,
    ...sizeStyles[size],
  };

  if (dot) {
    return (
      <span style={{ position: "relative" }}>
        {children}
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 8,
            height: 8,
            backgroundColor: colors[variant],
            borderRadius: "50%",
          }}
        />
      </span>
    );
  }

  return <span style={badgeStyle}>{content}</span>;
};

interface ProgressProps {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  variant?: "bar" | "circular" | "spinner";
  color?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value = 0,
  max = 100,
  indeterminate,
  variant = "bar",
  color = "#3b82f6",
}) => {
  if (variant === "circular") {
    return (
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "4px solid #e5e7eb",
          borderTopColor: color,
          animation: indeterminate ? "spin 1s linear infinite" : undefined,
        }}
      />
    );
  }

  if (variant === "spinner") {
    return <Spinner size="md" color={color} />;
  }

  const percent = indeterminate ? 50 : (value / max) * 100;

  return (
    <div
      style={{
        width: "100%",
        height: 8,
        backgroundColor: "#e5e7eb",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: "100%",
          backgroundColor: color,
          transition: indeterminate ? undefined : "width 0.3s",
        }}
      />
    </div>
  );
};

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  color = "#3b82f6",
}) => {
  const sizeMap = { sm: 16, md: 24, lg: 32, xl: 48 };

  return (
    <div
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        border: `3px solid #e5e7eb`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }}
    />
  );
};

// ============================================================================
// EXPORT ALL COMPONENTS
// ============================================================================

export const DefaultComponents = {
  // Layout
  Container,
  Spacer,
  Divider,

  // Text
  Text,

  // Inputs
  Button,
  Input,
  Textarea,
  Checkbox,
  Switch,
  Slider,

  // Display
  Image,
  Card,

  // Feedback
  Alert,
  Badge,
  Progress,
  Spinner,
};
