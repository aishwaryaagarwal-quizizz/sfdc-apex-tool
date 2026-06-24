import React, { useState, useEffect } from 'react';
import styles from './HomePage.module.css';

// ── helpers ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statVal} style={color ? { color } : {}}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

function PanelHeader({ icon, title, sub, color }) {
  return (
    <div className={styles.panelHeader} style={{ borderColor: color }}>
      <span className={styles.panelIcon}>{icon}</span>
      <div>
        <div className={styles.panelTitle}>{title}</div>
        {sub && <div className={styles.panelSub}>{sub}</div>}
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={styles.miniBar}>
      <div className={styles.miniBarLabel}>{label}</div>
      <div className={styles.miniBarTrack}>
        <div className={styles.miniBarFill} style={{ width: pct + '%', background: color || '#2E6DB4' }} />
      </div>
      <div className={styles.miniBarVal}>{value}</div>
    </div>
  );
}

function Badge({ label, type }) {
  const colors = {
    active: '#1B5E20', inactive: '#7D4E00', good: '#1B5E20',
    needswork: '#7D4E00', poor: '#8B0000', default: '#475569'
  };
  const bgs = {
    active: '#D4EFDF', inactive: '#FEF3CD', good: '#D4EFDF',
    needswork: '#FEF3CD', poor: '#FDECEA', default: '#F1F5F9'
  };
  const key = (type || 'default').toLowerCase().replace(' ', '');
  return (
    <span className={styles.badge}
      style={{ background: bgs[key] || bgs.default, color: colors[key] || colors.default }}>
      {label}
    </span>
  );
}

function ActionItem({ icon, title, desc, href, urgent }) {
  return (
    <a href={href} className={`${styles.actionItem} ${urgent ? styles.actionUrgent : ''}`}>
      <span className={styles.actionIcon}>{icon}</span>
      <div>
        <div className={styles.actionTitle}>{title}</div>
        <div className={styles.actionDesc}>{desc}</div>
      </div>
      <span className={styles.actionArrow}>→</span>
    </a>
  );
}

// ── APEX PANEL ────────────────────────────────────────────────────────
function ApexPanel({ data }) {
  const d = data || {
    total: 131, triggers: 21, prodClasses: 95, testClasses: 36,
    govRisks: 8, flowCandidates: 25, good: 118, needsWork: 13, poor: 0,
    domains: [
      { name: 'Quotes/CPQ', count: 30 }, { name: 'Finance', count: 26 },
      { name: 'Customer Success', count: 16 }, { name: 'General', count: 11 },
      { name: 'Sales', count: 8 }, { name: 'Marketing', count: 4 },
    ]
  };
  return (
    <div className={styles.panel}>
      <PanelHeader icon="⚡" title="Apex Code" sub={`${d.total} files · last refreshed from Salesforce`} color="#1B3A6B" />
      <div className={styles.panelStats}>
        <StatCard label="Total files" value={d.total} icon="📁" />
        <StatCard label="Gov risks" value={d.govRisks} icon="⚠️" color="#8B0000" sub="Need urgent fix" />
        <StatCard label="Flow candidates" value={d.flowCandidates} icon="🔄" color="#1B5E20" sub="Can be replaced" />
        <StatCard label="Needs work" value={d.needsWork} icon="🔧" color="#7D4E00" />
      </div>
      <div className={styles.panelSection}>
        <div className={styles.panelSectionTitle}>By domain</div>
        {d.domains.map(dom => (
          <MiniBar key={dom.name} label={dom.name} value={dom.count} max={d.total} color="#2E6DB4" />
        ))}
      </div>
      <div className={styles.panelSection}>
        <div className={styles.panelSectionTitle}>Quality breakdown</div>
        <div className={styles.qualityRow}>
          <Badge label={`✅ Good — ${d.good}`} type="good" />
          <Badge label={`⚠️ Needs Work — ${d.needsWork}`} type="needswork" />
          <Badge label={`❌ Poor — ${d.poor}`} type="poor" />
        </div>
      </div>
      <a href="#/inventory" className={styles.panelCta}>Open Apex Inventory →</a>
    </div>
  );
}

// ── FLOWS PANEL ───────────────────────────────────────────────────────
function FlowsPanel({ data }) {
  const d = data || {
    total: 300, active: 221, inactive: 79,
    categories: [
      { name: 'Opportunity / pipeline', count: 49 },
      { name: 'Customer Success', count: 39 },
      { name: 'Lead management', count: 31 },
      { name: 'Contact management', count: 16 },
      { name: 'Marketing attribution', count: 16 },
      { name: 'Quote / contract', count: 16 },
    ],
    objects: [
      { name: 'Opportunity', count: 70 },
      { name: 'Lead', count: 33 },
      { name: 'Contact', count: 30 },
      { name: 'Account', count: 16 },
    ],
    legacyWorkflow: 12,
    managedPackage: 77,
  };
  return (
    <div className={styles.panel}>
      <PanelHeader icon="🔀" title="Salesforce Flows" sub={`${d.total} flows · ${d.active} active · ${d.inactive} inactive`} color="#1B5E20" />
      <div className={styles.panelStats}>
        <StatCard label="Total flows" value={d.total} icon="🔀" />
        <StatCard label="Active" value={d.active} icon="✅" color="#1B5E20" />
        <StatCard label="Inactive" value={d.inactive} icon="⏸️" color="#7D4E00" sub="Review needed" />
        <StatCard label="Legacy workflows" value={d.legacyWorkflow} icon="🕰️" color="#8B0000" sub="Migrate to Flow" />
      </div>
      <div className={styles.panelSection}>
        <div className={styles.panelSectionTitle}>Top categories (custom flows only)</div>
        {d.categories.map(cat => (
          <MiniBar key={cat.name} label={cat.name} value={cat.count} max={d.total} color="#1B5E20" />
        ))}
      </div>
      <div className={styles.panelSection}>
        <div className={styles.panelSectionTitle}>Top trigger objects</div>
        <div className={styles.objectPills}>
          {d.objects.map(obj => (
            <span key={obj.name} className={styles.objectPill}>{obj.name} <strong>{obj.count}</strong></span>
          ))}
        </div>
      </div>
      <a href="#/flows" className={styles.panelCta}>Open Flow Inventory →</a>
    </div>
  );
}

// ── FIELDS PANEL ─────────────────────────────────────────────────────
function FieldsPanel({ data }) {
  const d = data || {
    total: 847, custom: 312, standard: 535,
    recommendations: [
      { label: 'Standard — keep', count: 535, color: '#1B5E20' },
      { label: 'Custom — keep', count: 198, color: '#2E6DB4' },
      { label: 'Custom — review', count: 89, color: '#7D4E00' },
      { label: 'Custom — deprecate', count: 25, color: '#8B0000' },
    ],
    themes: [
      { name: 'Enrollment / Size', count: 142 },
      { name: 'Revenue / ARR', count: 98 },
      { name: 'Onboarding', count: 76 },
      { name: 'Lead / Pipeline', count: 68 },
      { name: 'Other', count: 463 },
    ]
  };
  return (
    <div className={styles.panel}>
      <PanelHeader icon="🏷️" title="Field Registry" sub={`${d.total} fields · ${d.custom} custom · ${d.standard} standard`} color="#7D4E00" />
      <div className={styles.panelStats}>
        <StatCard label="Total fields" value={d.total} icon="🏷️" />
        <StatCard label="Custom fields" value={d.custom} icon="⚙️" color="#2E6DB4" />
        <StatCard label="Review needed" value={d.recommendations[2]?.count || 89} icon="⚠️" color="#7D4E00" />
        <StatCard label="Deprecate" value={d.recommendations[3]?.count || 25} icon="🗑️" color="#8B0000" />
      </div>
      <div className={styles.panelSection}>
        <div className={styles.panelSectionTitle}>Recommendation breakdown</div>
        {d.recommendations.map(r => (
          <MiniBar key={r.label} label={r.label} value={r.count} max={d.total} color={r.color} />
        ))}
      </div>
      <div className={styles.panelSection}>
        <div className={styles.panelSectionTitle}>Top themes / groups</div>
        {d.themes.slice(0, 4).map(t => (
          <MiniBar key={t.name} label={t.name} value={t.count} max={d.total} color="#7D4E00" />
        ))}
      </div>
      <a href="#/fields" className={styles.panelCta}>Open Field Registry →</a>
    </div>
  );
}

// ── ACTIONS PANEL ─────────────────────────────────────────────────────
function ActionsPanel() {
  return (
    <div className={styles.actionsPanel}>
      <div className={styles.actionsPanelTitle}>🎯 Priority actions</div>
      <ActionItem urgent icon="🔴" href="#/inventory"
        title="8 Apex files have governor limit risks"
        desc="SOQL or DML inside loops — will crash on bulk operations" />
      <ActionItem urgent icon="🟠" href="#/inventory"
        title="13 Apex files need quality fixes"
        desc="Debug statements, @future usage, high SOQL count" />
      <ActionItem icon="🕰️" href="#/flows"
        title="12 legacy Workflow Rules active"
        desc="Salesforce retiring Workflow Rules — migrate to Flow" />
      <ActionItem icon="🔀" href="#/flows"
        title="79 inactive Flows to review"
        desc="Deactivated flows taking up org space — review and delete" />
      <ActionItem icon="🏷️" href="#/fields"
        title="25 custom fields marked for deprecation"
        desc="Fields with no usage or superseded by newer fields" />
      <ActionItem icon="🔍" href="#/debugger"
        title="Debug any Apex or Flow issue"
        desc="Paste code, describe the problem, get an AI diagnosis" />
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────
export default function HomePage() {
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    try {
      const ts = localStorage.getItem('sfdc_last_refresh');
      if (ts) setLastRefresh(new Date(ts).toLocaleDateString());
    } catch(e) {}
  }, []);

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>RevOps Command Centre</h1>
          <p className={styles.headerSub}>
            Salesforce org health · Apex · Flows · Fields · Quizizz RevOps
            {lastRefresh && <span className={styles.headerRefresh}> · Last refreshed {lastRefresh}</span>}
          </p>
        </div>
        <div className={styles.headerActions}>
          <a href="#/inventory" className={styles.headerBtn}>🔄 Refresh Apex</a>
          <a href="#/flows" className={styles.headerBtn}>🔀 Refresh Flows</a>
        </div>
      </div>

      {/* Top summary strip */}
      <div className={styles.summaryStrip}>
        {[
          { val: '131', label: 'Apex files', color: '#1B3A6B', icon: '⚡' },
          { val: '300', label: 'Flows total', color: '#1B5E20', icon: '🔀' },
          { val: '221', label: 'Active flows', color: '#1B5E20', icon: '✅' },
          { val: '8',   label: 'Gov limit risks', color: '#8B0000', icon: '⚠️' },
          { val: '25',  label: 'Flow candidates', color: '#2E6DB4', icon: '🔄' },
          { val: '12',  label: 'Legacy workflows', color: '#8B0000', icon: '🕰️' },
        ].map(s => (
          <div key={s.label} className={styles.stripStat}>
            <span className={styles.stripIcon}>{s.icon}</span>
            <span className={styles.stripVal} style={{ color: s.color }}>{s.val}</span>
            <span className={styles.stripLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Three panels */}
      <div className={styles.panelGrid}>
        <ApexPanel />
        <FlowsPanel />
        <FieldsPanel />
      </div>

      {/* Actions */}
      <ActionsPanel />

      {/* Nav cards */}
      <div className={styles.navCards}>
        {[
          { href: '#/inventory', icon: '⚡', title: 'Apex Inventory', badge: 'Refresh anytime',
            desc: 'Full analysis of all 131 Apex classes and triggers — quality, gov risks, Flow candidates, domain.' },
          { href: '#/flows', icon: '🔀', title: 'Flow Inventory',
            desc: '300 Flows across 15 categories. Active vs inactive, by object, by category. Sync from your Google Sheet.' },
          { href: '#/fields', icon: '🏷️', title: 'Field Registry',
            desc: 'All fields from your Field Registry sheet. Filter by object, data type, theme, and recommendation.' },
          { href: '#/debugger', icon: '🔍', title: 'Debugger',
            desc: 'Paste any Apex or Flow XML. Describe what it should do. Get an AI diagnosis with exact code fixes.' },
          { href: '#/settings', icon: '⚙️', title: 'Settings',
            desc: 'Connect Salesforce, Anthropic API key, and your three Google Sheets.' },
        ].map(c => (
          <a key={c.href} href={c.href} className={styles.navCard}>
            <div className={styles.navCardIcon}>{c.icon}</div>
            <div className={styles.navCardBody}>
              <div className={styles.navCardTitle}>{c.title}
                {c.badge && <span className={styles.navCardBadge}>{c.badge}</span>}
              </div>
              <div className={styles.navCardDesc}>{c.desc}</div>
            </div>
            <span className={styles.navCardArrow}>→</span>
          </a>
        ))}
      </div>

    </div>
  );
}
