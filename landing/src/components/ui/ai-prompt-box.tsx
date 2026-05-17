import * as React from "react";
import { ArrowUp, Square, FileText, Globe, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const cn = (...c: (string | undefined | null | false)[]) => c.filter(Boolean).join(" ");

// Landing palette anchor points — matches Analyzer.tsx P object.
const COLORS = {
  bg: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.14)",
  borderFocus: "rgba(255,255,255,0.24)",
  text: "#fafafa",
  muted: "#a1a1aa",
  cyan: "#5dd9ff",
  violet: "#9b7bff",
  rose: "#ff6b8b",
  red: "#ff5d63",
};

export type ChatMode = "context" | "open" | "conspiracy";

const MODES: { value: ChatMode; label: string; color: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "context",    label: "Context",    color: COLORS.cyan,   icon: FileText },
  { value: "open",       label: "Web",        color: COLORS.violet, icon: Globe },
  { value: "conspiracy", label: "Conspiracy", color: COLORS.rose,   icon: AlertTriangle },
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
  <div className="relative h-3 w-px mx-0.5">
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background:
          "linear-gradient(to top, transparent 0%, rgba(155,123,255,0.45) 50%, transparent 100%)",
      }}
    />
  </div>
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

    const sendIconColor = canSend ? "#0a0a0f" : COLORS.muted;
    const sendBg = canSend ? "#fafafa" : "transparent";
    const sendHoverBg = canSend ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.06)";

    return (
      <div
        ref={ref}
        className={cn("rounded-lg p-1 transition-colors", className)}
        style={{
          background: COLORS.bg,
          border: `1px solid ${focused ? COLORS.borderFocus : COLORS.border}`,
          boxShadow: focused
            ? "0 0 0 2px rgba(155,123,255,0.10), 0 4px 14px rgba(0,0,0,0.20)"
            : "0 4px 14px rgba(0,0,0,0.20)",
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
          className="block w-full bg-transparent border-0 outline-none resize-none px-2 py-1"
          style={{
            color: COLORS.text,
            fontFamily: "inherit",
            fontSize: 11,
            lineHeight: 1.6,
            minHeight: 24,
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
                    title={`Chat mode: ${m.label}`}
                    aria-pressed={active}
                    className="rounded-full transition-all flex items-center gap-1"
                    style={{
                      height: 20,
                      padding: active ? "0 7px 0 5px" : "0 5px",
                      background: active ? `${m.color}26` : "transparent",
                      border: `1px solid ${active ? m.color : "transparent"}`,
                      color: active ? m.color : COLORS.muted,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <motion.span
                      animate={{ rotate: active ? 360 : 0, scale: active ? 1.05 : 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                      className="inline-flex"
                    >
                      <Icon className="w-2.5 h-2.5" />
                    </motion.span>
                    <AnimatePresence initial={false}>
                      {active && (
                        <motion.span
                          key="label"
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: "auto", opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="font-medium overflow-hidden whitespace-nowrap"
                          style={{ color: m.color, fontSize: 9.5, letterSpacing: "0.02em" }}
                        >
                          {m.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
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
            className="rounded-full inline-flex items-center justify-center transition-colors disabled:cursor-not-allowed"
            style={{
              height: 22,
              width: 22,
              background: isLoading ? "rgba(255,93,99,0.14)" : sendBg,
              color: isLoading ? COLORS.red : sendIconColor,
              border: isLoading ? `1px solid ${COLORS.red}` : "1px solid transparent",
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
