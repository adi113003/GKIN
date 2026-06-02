import * as React from "react";
import { ArrowUp, Square, FileText, Globe, AlertTriangle } from "lucide-react";

const cn = (...c: (string | undefined | null | false)[]) => c.filter(Boolean).join(" ");

// Airbnb-style palette - matches Analyzer.tsx P object (white canvas / Rausch).
const COLORS = {
  bg: "#ffffff",            // canvas
  panel: "#f7f7f7",         // surface-soft
  border: "#dddddd",        // hairline
  borderFocus: "#222222",   // ink (focus)
  text: "#222222",          // ink
  muted: "#6a6a6a",         // muted / insufficient
  navy: "#ff385c",          // Rausch accent
  red: "#9B1C2E",           // contradicted
};

export type ChatMode = "context" | "open" | "conspiracy";

const MODES: { value: ChatMode; label: string; color: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "context",    label: "Context",     color: COLORS.navy, icon: FileText },
  { value: "open",       label: "Web",         color: COLORS.navy, icon: Globe },
  { value: "conspiracy", label: "Speculative", color: COLORS.red,  icon: AlertTriangle },
];

interface PromptInputBoxProps {
  value: string;
  onValueChange: (v: string) => void;
  onSend: (message: string) => void;
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
  isLoading?: boolean;
  onStop?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const CustomDivider: React.FC = () => (
  <div className="h-3 w-px mx-1" style={{ background: COLORS.border }} />
);

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  (
    {
      value,
      onValueChange,
      onSend,
      mode,
      onModeChange,
      isLoading = false,
      onStop,
      placeholder = "Ask a question about the article…",
      className,
      autoFocus = false,
    },
    ref,
  ) => {
    const taRef = React.useRef<HTMLTextAreaElement>(null);
    const [focused, setFocused] = React.useState(false);

    // Autosize the textarea up to a soft max.
    React.useLayoutEffect(() => {
      const el = taRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
    }, [value]);

    React.useEffect(() => {
      if (autoFocus) taRef.current?.focus();
    }, [autoFocus]);

    const trimmed = value.trim();
    const canSend = trimmed.length > 0 && !isLoading;

    const submit = () => {
      if (!canSend) return;
      onSend(trimmed);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    };

    const sendIconColor = canSend ? COLORS.bg : COLORS.muted;
    const sendBg = canSend ? COLORS.navy : "transparent";
    const sendHoverBg = canSend ? COLORS.text : COLORS.panel;

    return (
      <div
        ref={ref}
        className={cn("p-2 transition-colors", className)}
        style={{
          background: COLORS.bg,
          border: `1px solid ${focused ? COLORS.borderFocus : COLORS.border}`,
          borderRadius: 14,
        }}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
        }}
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          className="block w-full bg-transparent border-0 outline-none resize-none px-3 py-2"
          style={{
            color: COLORS.text,
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: 1.5,
            minHeight: 28,
            letterSpacing: "0",
          }}
        />

        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Mode pills */}
          <div className="flex items-center">
            {MODES.map((m, i) => {
              const active = mode === m.value;
              const Icon = m.icon;
              return (
                <React.Fragment key={m.value}>
                  {i > 0 && <CustomDivider />}
                  <button
                    type="button"
                    onClick={() => onModeChange(m.value)}
                    title={`Mode: ${m.label}`}
                    aria-pressed={active}
                    className="transition-colors flex items-center gap-1.5"
                    style={{
                      height: 28,
                      padding: "0 12px",
                      borderRadius: 9999,
                      background: active ? m.color : "transparent",
                      border: `1px solid ${active ? m.color : COLORS.border}`,
                      color: active ? "#ffffff" : COLORS.muted,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    <span
                      className="font-medium whitespace-nowrap"
                      style={{ fontSize: 11.5, letterSpacing: "0" }}
                    >
                      {m.label}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Send / Stop button */}
          <button
            type="button"
            onClick={() => (isLoading ? onStop?.() : submit())}
            disabled={!isLoading && !canSend}
            title={isLoading ? "Stop generation" : canSend ? "Send (Enter)" : "Type a message to send"}
            aria-label={isLoading ? "Stop" : "Send message"}
            className="inline-flex items-center justify-center transition-colors disabled:cursor-not-allowed"
            style={{
              height: 32,
              width: 32,
              borderRadius: 9999,
              background: isLoading ? "transparent" : sendBg,
              color: isLoading ? COLORS.red : sendIconColor,
              border: isLoading ? `1px solid ${COLORS.red}` : `1px solid ${canSend ? COLORS.navy : COLORS.border}`,
              opacity: !isLoading && !canSend ? 0.55 : 1,
            }}
            onMouseEnter={(e) => {
              if (isLoading) return;
              (e.currentTarget as HTMLButtonElement).style.background = sendHoverBg;
            }}
            onMouseLeave={(e) => {
              if (isLoading) return;
              (e.currentTarget as HTMLButtonElement).style.background = sendBg;
            }}
          >
            {isLoading ? (
              <Square className="h-2.5 w-2.5" fill={COLORS.red} />
            ) : (
              <ArrowUp className="h-3 w-3" strokeWidth={2.8} />
            )}
          </button>
        </div>
      </div>
    );
  },
);
PromptInputBox.displayName = "PromptInputBox";
