import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function PageShell({
  children,
  narrow,
  className = "",
}: {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <main className={`ui-page ${narrow ? "ui-page-narrow" : ""} ${className}`.trim()}>
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="ui-head">
      <div className="min-w-0">
        <h1 className="ui-title">{title}</h1>
        {sub ? <p className="ui-sub">{sub}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Chip({
  children,
  on,
  mountain,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; mountain?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={!!on}
      className={`ui-chip ${mountain ? "ui-chip-mountain" : ""} ${on ? "is-on" : ""}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      className={`ui-btn ui-btn-${variant} ${className}`.trim()}
      type={props.type || "button"}
      {...props}
    />
  );
}

export function Field({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-field ${className}`.trim()} {...props} />;
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`ui-panel ${className}`.trim()}>{children}</div>;
}
