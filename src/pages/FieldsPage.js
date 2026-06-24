import React, { useState } from 'react';
import { PageHeader, Card, Btn, Alert, Tabs } from '../components/UI';
import { loadConfig } from '../utils/api';
import styles from './InventoryPage.module.css';

export default function FieldsPage() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [filterRec, setFilterRec] = useState('');
  const [filterTheme, setFilterTheme] = useState('');
  const [filterType, setFilterType] = useState('');
  const cfg = loadConfig();

  const loadFields = async () => {
    if (!cfg.fieldSheetId && !cfg.sheetId) {
      setError('Add your Field Registry Sheet ID in Settings first.'); return;
    }
    setLoading(true); setError('');
    try {
      const sheetId = cfg.fieldSheetId || cfg.sheetId;
      const tab = encodeURIComponent('Sheet1');
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}?key=${cfg.gapiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Sheet error: ${res.status}`);
      const data = await res.json();
      const rows = (data.values || []).slice(1).map(r => ({
        apiName: r[0]||'', label: r[1]||'', dataType: r[2]||'', category: r[3]||'',
        theme: r[4]||'', recommendation: r[5]||'', notes: r[6]||'',
      }));
      setFields(rows);
      try { localStorage.setItem('sfdc_fields_cache', JSON.stringify(rows.slice(0,500))); } catch(e){}
    } catch(e) {
      setError(e.message + ' — connect your Field Registry sheet in Settings to load live data');
    }
    setLoading(false);
  };

  React.useEffect(() => {
    try {
      const cached = localStorage.getItem('sfdc_fields_cache');
      if (cached) setFields(JSON.parse(cached));
    } catch(e) {}
  }, []);

  const themes = [...new Set(fields.map(f=>f.theme).filter(Boolean))].sort();
  const recs = [...new Set(fields.map(f=>f.recommendation).filter(Boolean))].sort();
  const types = [...new Set(fields.map(f=>f.dataType).filter(Boolean))].sort();
  const custom = fields.filter(f=>f.category==='Custom').length;
  const standard = fields.filter(f=>f.category==='Standard').length;
  const toReview = fields.filter(f=>f.recommendation&&(f.recommendation.toLowerCase().includes('review')||f.recommendation.toLowerCase().includes('deprecate'))).length;

  const filtered = fields.filter(f => {
    const q = search.toLowerCase();
    if (search && !f.apiName.toLowerCase().includes(q) && !f.label.toLowerCase().includes(q)) return false;
    if (filterRec && f.recommendation !== filterRec) return false;
    if (filterTheme && f.theme !== filterTheme) return false;
    if (filterType && f.dataType !== filterType) return false;
    return true;
  });

  const TABS = [
    { id: 'overview', label: '📊  Overview' },
    { id: 'all', label: `🏷️  All Fields ${fields.length ? `(${fields.length})` : ''}` },
  ];

  return (
    <div>
      <PageHeader
        title="Field Registry"
        subtitle="All Salesforce fields from your Field Registry sheet. Filter by object, data type, theme, and recommendation."
        action={
          <Btn variant="primary" onClick={loadFields} disabled={loading}>
            {loading ? '⏳ Loading...' : '🏷️ Sync from Sheet'}
          </Btn>
        }
      />

      {error && <Alert type="warning">{error}</Alert>}

      {fields.length === 0 && (
        <Alert type="info">
          Connect your Field Registry Google Sheet in Settings, then click "Sync from Sheet" to load your field data.
          The Field Registry sheet should have columns: API Name · Label · Data Type · Field Category · Theme / Group · Recommendation · Notes / Action.
        </Alert>
      )}

      {fields.length > 0 && (
        <>
          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {tab === 'overview' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
                {[
                  { label:'Total fields', val:fields.length, color:'#1B3A6B' },
                  { label:'Custom fields', val:custom, color:'#2E6DB4' },
                  { label:'Standard fields', val:standard, color:'#1B5E20' },
                  { label:'Need review', val:toReview, color:'#8B0000' },
                ].map(s => (
                  <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:'14px 16px' }}>
                    <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <Card title="By recommendation" icon="✅">
                  {recs.slice(0,8).map(rec => {
                    const count = fields.filter(f=>f.recommendation===rec).length;
                    return (
                      <div key={rec} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                        <div style={{ fontSize:12, color:'#475569', flex:1 }}>{rec}</div>
                        <div style={{ fontSize:12, fontWeight:600, color:'#1B3A6B' }}>{count}</div>
                      </div>
                    );
                  })}
                </Card>
                <Card title="By theme / group" icon="🏷️">
                  {themes.slice(0,8).map(theme => {
                    const count = fields.filter(f=>f.theme===theme).length;
                    return (
                      <div key={theme} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                        <div style={{ fontSize:12, color:'#475569', flex:1 }}>{theme}</div>
                        <div style={{ width:60, height:8, background:'#F1F5F9', borderRadius:4, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:Math.round((count/fields.length)*100)+'%', background:'#7D4E00', borderRadius:4 }} />
                        </div>
                        <div style={{ fontSize:12, fontWeight:600, color:'#1B3A6B', width:28, textAlign:'right' }}>{count}</div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            </>
          )}

          {tab === 'all' && (
            <Card title="All fields" icon="🏷️">
              <div className={styles.filterRow}>
                <input className={styles.searchInput} placeholder="Search by API name or label..."
                  value={search} onChange={e=>setSearch(e.target.value)} />
                <select className={styles.filterSelect} value={filterRec} onChange={e=>setFilterRec(e.target.value)}>
                  <option value="">All recommendations</option>
                  {recs.map(r=><option key={r}>{r}</option>)}
                </select>
                <select className={styles.filterSelect} value={filterTheme} onChange={e=>setFilterTheme(e.target.value)}>
                  <option value="">All themes</option>
                  {themes.map(t=><option key={t}>{t}</option>)}
                </select>
                <select className={styles.filterSelect} value={filterType} onChange={e=>setFilterType(e.target.value)}>
                  <option value="">All types</option>
                  {types.slice(0,20).map(t=><option key={t}>{t}</option>)}
                </select>
                <span className={styles.filterCount}>{filtered.length} of {fields.length}</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>API Name</th><th>Label</th><th>Type</th><th>Category</th><th>Theme</th><th>Recommendation</th></tr></thead>
                  <tbody>
                    {filtered.slice(0,200).map((f,i)=>(
                      <tr key={i}>
                        <td className={styles.nameCell}>{f.apiName}</td>
                        <td style={{fontSize:13}}>{f.label}</td>
                        <td style={{fontSize:12,color:'#475569'}}>{f.dataType}</td>
                        <td style={{fontSize:12,color:'#64748B'}}>{f.category}</td>
                        <td style={{fontSize:12,color:'#64748B'}}>{f.theme}</td>
                        <td style={{fontSize:12,color:f.recommendation?.toLowerCase().includes('deprecate')?'#8B0000':f.recommendation?.toLowerCase().includes('review')?'#7D4E00':'#1B5E20'}}>{f.recommendation}</td>
                      </tr>
                    ))}
                    {filtered.length===0&&<tr><td colSpan={6} className={styles.emptyRow}>No fields match the filters</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
