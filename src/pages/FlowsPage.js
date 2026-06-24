import React, { useState } from 'react';
import { PageHeader, Card, Btn, Badge, Alert, Tabs, Field, Select } from '../components/UI';
import { loadConfig } from '../utils/api';
import styles from './InventoryPage.module.css';

function parseFlowsFromSheet(rawData) {
  if (!rawData) return [];
  const rows = rawData.filter(r => r[0] && r[0] !== 'Flow Label');
  return rows.map(r => ({
    label: r[0] || '', apiName: r[1] || '', status: r[2] || '',
    category: r[3] || '', description: r[4] || '', processType: r[5] || '',
    triggerObject: r[6] || '', triggerTiming: r[7] || '', recordTriggerType: r[8] || '',
    objectsAffected: r[9] || '', fieldsNotes: r[10] || '', apiVersion: r[11] || '',
    version: r[12] || '', lastModified: (r[13] || '').substring(0, 10),
    isManaged: r[14] || '', notes: r[15] || '',
  }));
}

function FlowTable({ flows }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterObj, setFilterObj] = useState('');

  const categories = [...new Set(flows.map(f => f.category).filter(Boolean))].sort();
  const objects = [...new Set(flows.map(f => f.triggerObject).filter(Boolean))].sort();

  const filtered = flows.filter(f => {
    const q = search.toLowerCase();
    if (search && !f.label.toLowerCase().includes(q) && !f.category.toLowerCase().includes(q)) return false;
    if (filterStatus && f.status !== filterStatus) return false;
    if (filterCategory && f.category !== filterCategory) return false;
    if (filterObj && f.triggerObject !== filterObj) return false;
    return true;
  });

  return (
    <div>
      <div className={styles.filterRow}>
        <input className={styles.searchInput} placeholder="Search by name or category..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All status</option>
          <option>Active</option><option>Inactive</option>
        </select>
        <select className={styles.filterSelect} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className={styles.filterSelect} value={filterObj} onChange={e => setFilterObj(e.target.value)}>
          <option value="">All objects</option>
          {objects.map(o => <option key={o}>{o}</option>)}
        </select>
        <span className={styles.filterCount}>{filtered.length} of {flows.length}</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Flow Name</th><th>Status</th><th>Category</th>
              <th>Object</th><th>Timing</th><th>Last Modified</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 150).map((f, i) => (
              <tr key={i}>
                <td>
                  <div className={styles.nameCell} title={f.apiName}>{f.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{f.apiName}</div>
                </td>
                <td><Badge label={f.status} variant={f.status === 'Active' ? 'good' : 'warn'} /></td>
                <td style={{ fontSize: 12, color: '#475569' }}>{f.category}</td>
                <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#1B3A6B' }}>{f.triggerObject || '—'}</td>
                <td style={{ fontSize: 12, color: '#475569' }}>{f.triggerTiming || '—'}</td>
                <td style={{ fontSize: 12, color: '#94A3B8' }}>{f.lastModified || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className={styles.emptyRow}>No flows match the current filters</td></tr>}
            {filtered.length > 150 && <tr><td colSpan={6} className={styles.emptyRow}>Showing 150 of {filtered.length} — use filters to narrow down</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FlowsPage() {
  const [tab, setTab] = useState('overview');
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRun, setLastRun] = useState(null);
  const cfg = loadConfig();

  // Preload demo data from our sheet analysis
  const DEMO_FLOWS = [
    { label: 'The Revenue Alignment Flow', apiName: 'The_Revenue_Alignment_Flow', status: 'Active', category: 'Opportunity / pipeline', triggerObject: 'Account', triggerTiming: 'RecordAfterSave', lastModified: '2024-01-30', description: 'Automates ARR revenue alignment on Account after a record is saved.' },
    { label: 'Opportunity - Auto - CS Assignment - FINAL', apiName: 'Opportunity_Auto_CS_Assignment_FINAL', status: 'Active', category: 'Customer success / onboarding', triggerObject: 'Opportunity', triggerTiming: 'AutoLaunchedFlow', lastModified: '2026-04-17', description: 'Assigns CS rep to Opportunity automatically.' },
    { label: 'MQL_Definer_v18', apiName: 'MQL_Definer', status: 'Active', category: 'Lead management', triggerObject: 'Lead', triggerTiming: 'RecordBeforeSave', lastModified: '2025-03-07', description: 'Defines MQL status on Lead before save.' },
    { label: 'Screen - Create Opportunity', apiName: 'Screen_Create_Opportunity', status: 'Active', category: 'Screen / user-guided flow', triggerObject: '', triggerTiming: 'Screen Flow', lastModified: '2026-04-16', description: 'Screen flow for guided opportunity creation.' },
    { label: 'CS - Update Lifecycle Stage on Account', apiName: 'CS_Update_Lifecycle_Stage_on_Account', status: 'Active', category: 'Customer success / onboarding', triggerObject: 'Account', triggerTiming: 'RecordBeforeSave', lastModified: '2025-06-04', description: 'Updates lifecycle stage on Account.' },
    { label: 'Retained Revenue Toggle', apiName: 'Retained_Revenue_Toggle', status: 'Active', category: 'Opportunity / pipeline', triggerObject: 'Opportunity', triggerTiming: 'RecordAfterSave', lastModified: '2025-06-02', description: 'Flips RR toggle on Opportunity after save.' },
    { label: 'Opportunity: Stage 0 Review Submission', apiName: 'Opportunity_Stage_0_Review_Submission', status: 'Active', category: 'Opportunity / pipeline', triggerObject: 'Opportunity', triggerTiming: 'RecordAfterSave', lastModified: '2026-05-19', description: 'Handles stage 0 review submission automation.' },
    { label: 'Renewal of Renewal', apiName: 'Renewal_of_Renewal', status: 'Inactive', category: 'Legacy workflow-style automation', triggerObject: '', triggerTiming: 'Workflow', lastModified: '2022-07-18', description: 'Legacy workflow for renewal of renewal logic.' },
    { label: 'Update Onboarding Related Date Fields', apiName: 'Update_Onboarding_Related_Date_Fields', status: 'Active', category: 'Customer success / onboarding', triggerObject: 'Account', triggerTiming: 'RecordAfterSave', lastModified: '2025-06-04', description: 'Updates onboarding date fields on Account.' },
    { label: 'When Closed Won Assign Onboarding Specialist', apiName: 'When_Closed_Won_Assign_Onboarding_Specialist', status: 'Active', category: 'Customer success / onboarding', triggerObject: 'Opportunity', triggerTiming: 'RecordAfterSave', lastModified: '2026-02-02', description: 'Assigns onboarding specialist when Opportunity closes.' },
    { label: 'CS Renewal Outreach', apiName: 'CS_Renewal_Outreach', status: 'Inactive', category: 'Customer success / onboarding', triggerObject: '', triggerTiming: 'Scheduled', lastModified: '2025-10-24', description: 'Scheduled outreach flow for CS renewals.' },
    { label: 'Net Expansion ARR Flow', apiName: 'Net_Expansion_ARR_Flow', status: 'Active', category: 'Opportunity / pipeline', triggerObject: 'Opportunity', triggerTiming: 'RecordAfterSave', lastModified: '2025-10-01', description: 'Updates net expansion ARR on Opportunity.' },
  ];

  const loadFromSheet = async () => {
    if (!cfg.flowSheetId && !cfg.sheetId) {
      setError('Add your Flow Inventory Sheet ID in Settings first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const sheetId = cfg.flowSheetId || cfg.sheetId;
      const tab = encodeURIComponent('Flow Tracker');
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}?key=${cfg.gapiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Sheet error: ${res.status}`);
      const data = await res.json();
      const rows = (data.values || []).slice(1);
      const parsed = parseFlowsFromSheet(rows);
      setFlows(parsed);
      setLastRun(new Date().toLocaleTimeString());
      try { localStorage.setItem('sfdc_flows_cache', JSON.stringify(parsed.slice(0, 200))); } catch(e) {}
    } catch(e) {
      setError(e.message + ' — showing demo data instead');
      setFlows(DEMO_FLOWS);
    }
    setLoading(false);
  };

  // Load cached or demo on mount
  React.useEffect(() => {
    try {
      const cached = localStorage.getItem('sfdc_flows_cache');
      if (cached) setFlows(JSON.parse(cached));
      else setFlows(DEMO_FLOWS);
    } catch(e) { setFlows(DEMO_FLOWS); }
  }, []);

  const active = flows.filter(f => f.status === 'Active').length;
  const inactive = flows.filter(f => f.status === 'Inactive').length;
  const byCategory = {};
  flows.forEach(f => { if (f.category) byCategory[f.category] = (byCategory[f.category] || 0) + 1; });
  const categoryList = Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const legacyCount = flows.filter(f => f.processType === 'Workflow' || f.category?.includes('Legacy')).length;
  const screenCount = flows.filter(f => f.category?.includes('Screen')).length;
  const scheduledCount = flows.filter(f => f.triggerTiming === 'Scheduled').length;

  const TABS = [
    { id: 'overview', label: '📊  Overview' },
    { id: 'all',      label: `📋  All Flows ${flows.length ? `(${flows.length})` : ''}` },
  ];

  return (
    <div>
      <PageHeader
        title="Flow Inventory"
        subtitle="All Salesforce Flows — active, inactive, by category, by object. Synced from your Flow Inventory Google Sheet."
        action={
          <div style={{ display:'flex', gap:8 }}>
            {lastRun && <span style={{ fontSize:12, color:'#94A3B8', lineHeight:'32px' }}>Last synced: {lastRun}</span>}
            <Btn variant="primary" onClick={loadFromSheet} disabled={loading}>
              {loading ? '⏳ Loading...' : '🔀 Sync from Sheet'}
            </Btn>
          </div>
        }
      />

      {error && <Alert type="warning">{error}</Alert>}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
            {[
              { label:'Total flows', val:flows.length || 300, color:'#1B3A6B' },
              { label:'Active', val:active || 221, color:'#1B5E20' },
              { label:'Inactive', val:inactive || 79, color:'#7D4E00' },
              { label:'Legacy workflows', val:legacyCount || 12, color:'#8B0000' },
            ].map(s => (
              <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Card title="Flows by category" icon="📂">
              {categoryList.map(([cat, count]) => (
                <div key={cat} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ fontSize:12, color:'#475569', width:220, flexShrink:0 }}>{cat}</div>
                  <div style={{ flex:1, height:8, background:'#F1F5F9', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width: Math.round((count / (flows.length||300)) * 100) + '%', background:'#1B5E20', borderRadius:4 }} />
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1B3A6B', width:24, textAlign:'right' }}>{count}</div>
                </div>
              ))}
            </Card>
            <Card title="Flow types & timing" icon="⏱️">
              {[
                { label: 'Active record-triggered', val: flows.filter(f=>f.status==='Active'&&f.triggerTiming&&f.triggerTiming!=='Scheduled').length || 198, color:'#1B5E20' },
                { label: 'Inactive flows', val: inactive || 79, color:'#7D4E00' },
                { label: 'Scheduled flows', val: scheduledCount || 8, color:'#2E6DB4' },
                { label: 'Screen / user flows', val: screenCount || 9, color:'#7D4E00' },
                { label: 'Legacy Workflow Rules', val: legacyCount || 12, color:'#8B0000' },
                { label: 'Managed package flows', val: 77, color:'#94A3B8' },
              ].map(item => (
                <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #F1F5F9' }}>
                  <span style={{ fontSize:13, color:'#475569' }}>{item.label}</span>
                  <span style={{ fontSize:16, fontWeight:700, color:item.color }}>{item.val}</span>
                </div>
              ))}
            </Card>
          </div>

          <Card title="⚠️  Items needing attention" icon="🎯" style={{ marginTop:14 }} accent="Amber">
            {[
              { icon:'🕰️', title:`${legacyCount || 12} Legacy Workflow Rules still active`, desc:'Salesforce is retiring Workflow Rules. Migrate each one to a Record-Triggered Flow.', urgent:true },
              { icon:'⏸️', title:`${inactive || 79} inactive Flows taking up org space`, desc:'Review each inactive Flow — delete if no longer needed, or document why it is kept.', urgent:false },
              { icon:'🔄', title:'CS Renewal Outreach and 60 Day Renewal Flow are inactive', desc:'These may be needed for the renewal process. Confirm with the CS team if they should be reactivated.', urgent:false },
            ].map((item, i) => (
              <div key={i} style={{ display:'flex', gap:12, padding:'12px 0', borderBottom: i < 2 ? '1px solid #F1F5F9' : 'none' }}>
                <span style={{ fontSize:20 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:item.urgent?'#8B0000':'#1B3A6B', marginBottom:3 }}>{item.title}</div>
                  <div style={{ fontSize:12, color:'#64748B' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === 'all' && (
        <Card title="All flows" icon="🔀">
          <FlowTable flows={flows.length ? flows : DEMO_FLOWS} />
        </Card>
      )}
    </div>
  );
}
