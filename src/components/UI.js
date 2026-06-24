import React from 'react';
import styles from './UI.module.css';

// ── Badge ──────────────────────────────────────────────────────────────
export function Badge({ label, variant }) {
  const map = {
    good: styles.badgeGood, 'needs work': styles.badgeWarn, poor: styles.badgeBad,
    yes: styles.badgeGood, probably: styles.badgeWarn, unlikely: styles.badgeWarn,
    no: styles.badgeBad, 'n/a': styles.badgeGray,
    new: styles.badgeBlue, changed: styles.badgeWarn, unchanged: styles.badgeGray,
    critical: styles.badgeBad, high: styles.badgeBad, medium: styles.badgeWarn, low: styles.badgeBlue,
  };
  const cls = map[(label || '').toLowerCase()] || styles.badgeGray;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

// ── Card ───────────────────────────────────────────────────────────────
export function Card({ title, icon, action, children, accent }) {
  return (
    <div className={`${styles.card} ${accent ? styles[`cardAccent${accent}`] : ''}`}>
      {(title || action) && (
        <div className={styles.cardHeader}>
          {icon && <span className={styles.cardIcon}>{icon}</span>}
          {title && <span className={styles.cardTitle}>{title}</span>}
          {action && <div className={styles.cardAction}>{action}</div>}
        </div>
      )}
      <div className={styles.cardBody}>{children}</div>
    </div>
  );
}

// ── Button ─────────────────────────────────────────────────────────────
export function Btn({ onClick, disabled, variant = 'default', size = 'md', children, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${styles.btn} ${styles[`btn${variant.charAt(0).toUpperCase() + variant.slice(1)}`] || ''} ${styles[`btnSz${size.toUpperCase()}`] || ''}`}
    >
      {children}
    </button>
  );
}

// ── Field ──────────────────────────────────────────────────────────────
export function Field({ label, help, children }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.fieldLabel}>{label}</label>}
      {children}
      {help && <p className={styles.fieldHelp}>{help}</p>}
    </div>
  );
}

export function Input({ ...props }) {
  return <input className={styles.input} {...props} />;
}

export function Select({ children, ...props }) {
  return <select className={styles.input} {...props}>{children}</select>;
}

export function Textarea({ ...props }) {
  return <textarea className={styles.textarea} {...props} />;
}

// ── Page header ────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <p className={styles.pageSub}>{subtitle}</p>}
      </div>
      {action && <div className={styles.pageAction}>{action}</div>}
    </div>
  );
}

// ── Step progress ──────────────────────────────────────────────────────
export function StepRow({ num, title, subtitle, state }) {
  const numClass = state === 'done' ? styles.stepDone
    : state === 'active' ? styles.stepActive
    : state === 'error' ? styles.stepError
    : styles.stepIdle;
  return (
    <div className={styles.stepRow}>
      <div className={`${styles.stepNum} ${numClass}`}>
        {state === 'done' ? '✓' : state === 'error' ? '✗' : num}
      </div>
      <div className={styles.stepBody}>
        <div className={styles.stepTitle}>{title}</div>
        {subtitle && <div className={styles.stepSub}>{subtitle}</div>}
      </div>
      {state === 'active' && <div className={styles.spinner} />}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────
export function Stat({ label, value, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statVal} style={color ? { color } : {}}>{value}</div>
    </div>
  );
}

// ── Code block ─────────────────────────────────────────────────────────
export function CodeBlock({ code, language = 'apex' }) {
  return (
    <pre className={styles.codeBlock}>
      <code>{code}</code>
    </pre>
  );
}

// ── Alert ──────────────────────────────────────────────────────────────
export function Alert({ type = 'info', children }) {
  const cls = {
    info: styles.alertInfo, warning: styles.alertWarn,
    error: styles.alertError, success: styles.alertSuccess,
  }[type] || styles.alertInfo;
  return <div className={`${styles.alert} ${cls}`}>{children}</div>;
}

// ── Tabs ───────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className={styles.tabs}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`${styles.tab} ${active === t.id ? styles.tabActive : ''}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
