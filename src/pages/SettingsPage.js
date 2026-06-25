import React, { useState, useEffect } from 'react';
import { PageHeader, Card, Btn, Field, Input, Select, Alert } from '../components/UI';
import { loadConfig, saveConfig } from '../utils/api';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const [cfg, setCfg] = useState({
    sfUrl: '', sfToken: '', sfVersion: 'v66.0',
    anthropicKey: '',
    sheetId: '', sheetTab: 'Full Inventory', gapiKey: '',
    batchSize: '20',
  });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState('');
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    const loaded = loadConfig();
    if (loaded) setCfg(p => ({ ...p, ...loaded }));
  }, []);

  const save = () => {
    saveConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const set = (key, val) => setCfg(p => ({ ...p, [key]: val }));

  const PROXY_URL = 'https://sfdc-proxy.aishwaryaagarwal-quizizz.workers.dev';

  const testSF = async () => {
    setTesting('sf'); setTestResult(null);
    try {
      // Test proxy health first
      const health = await fetch(`${PROXY_URL}/health`).catch(() => null);
      if (!health || !health.ok) {
        setTestResult({ type: 'error', msg: '✗ Proxy worker not reachable — deploy the worker first (see instructions below)' });
        setTesting(''); return;
      }
      // Test SF connection through proxy
      const url = `${PROXY_URL}/sf/services/data/${cfg.sfVersion}/tooling/query?q=SELECT+COUNT()+FROM+ApexClass+WHERE+NamespacePrefix+=+null`;
      const res = await fetch(url, {
        headers: { 'X-SF-Token': cfg.sfToken, 'X-SF-Instance': cfg.sfUrl, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} — check your session token`);
      const d = await res.json();
      setTestResult({ type: 'success', msg: `✓ Connected via proxy — ${d.records?.[0]?.expr0 || d.totalSize || '?'} custom Apex classes found` });
    } catch (e) {
      setTestResult({ type: 'error', msg: `✗ ${e.message}` });
    }
    setTesting('');
  };

  const testSheet = async () => {
    setTesting('sheet'); setTestResult(null);
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheetId}?key=${cfg.gapiKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTestResult({ type: 'success', msg: `✓ Sheet connected — "${d.properties?.title}"` });
    } catch (e) {
      setTestResult({ type: 'error', msg: `✗ ${e.message}` });
    }
    setTesting('');
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure your Salesforce connection, Anthropic API key, and Google Sheets sync."
        action={<Btn variant="primary" onClick={save}>{saved ? '✓ Saved' : 'Save settings'}</Btn>}
      />

      <Card title="Salesforce connection" icon="☁️">
        <div className={styles.formGrid}>
          <Field label="Instance URL" help="e.g. https://quizizz.my.salesforce.com — no trailing slash">
            <Input type="url" value={cfg.sfUrl} onChange={e => set('sfUrl', e.target.value)} placeholder="https://yourorg.my.salesforce.com" />
          </Field>
          <Field label="API version">
            <Select value={cfg.sfVersion} onChange={e => set('sfVersion', e.target.value)}>
              <option value="v66.0">v66.0 (latest)</option>
              <option value="v63.0">v63.0</option>
              <option value="v60.0">v60.0</option>
              <option value="v59.0">v59.0</option>
            </Select>
          </Field>
        </div>
        <Field label="Session token"
          help="Get it from Workbench → Info → Session Information → copy SessionId. Tokens expire after a few hours.">
          <Input type="password" value={cfg.sfToken} onChange={e => set('sfToken', e.target.value)} placeholder="00D5j..." />
        </Field>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <Btn onClick={testSF} disabled={testing === 'sf' || !cfg.sfUrl || !cfg.sfToken}>
            {testing === 'sf' ? 'Testing...' : 'Test Salesforce connection'}
          </Btn>
          {testResult && <span style={{ fontSize: 13, color: testResult.type === 'success' ? '#1B5E20' : '#8B0000' }}>{testResult.msg}</span>}
        </div>
      </Card>

      <Card title="AI analysis — Anthropic or Portkey" icon="🤖">
        <Field label="API key"
          help="Paste your Portkey key (starts with pk-) OR your Anthropic key (starts with sk-ant-). The tool detects which one automatically.">
          <Input type="password" value={cfg.anthropicKey} onChange={e => set('anthropicKey', e.target.value)} placeholder="pk-... or sk-ant-..." />
        </Field>
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          <div style={{ flex:1, background:'#EBF3FF', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
            <strong style={{ color:'#1B3A6B' }}>🔑 Portkey</strong>
            <p style={{ color:'#475569', marginTop:4, fontSize:12, lineHeight:1.6 }}>
              Your key starts with <code style={{background:'#D6E4F7',padding:'1px 5px',borderRadius:4}}>pk-</code>.
              Get it from portkey.ai → API Keys. Routes through Portkey gateway to Claude.
            </p>
          </div>
          <div style={{ flex:1, background:'#F8FAFC', borderRadius:8, padding:'10px 14px', fontSize:13, border:'1px solid #E2E8F0' }}>
            <strong style={{ color:'#475569' }}>🔑 Anthropic (direct)</strong>
            <p style={{ color:'#94A3B8', marginTop:4, fontSize:12, lineHeight:1.6 }}>
              Your key starts with <code style={{background:'#F1F5F9',padding:'1px 5px',borderRadius:4}}>sk-ant-</code>.
              Get it from console.anthropic.com → API Keys.
            </p>
          </div>
        </div>
        <div style={{ marginTop:10, padding:'8px 12px', background:'#D4EFDF', borderRadius:8, fontSize:12, color:'#1B5E20' }}>
          ✓ Your API key is stored only in your browser — never sent to any server other than the AI provider directly.
        </div>
      </Card>

      <Card title="Google Sheets sync" icon="📊">
        <div className={styles.formGrid}>
          <Field label="Sheet ID"
            help="The long ID in your Sheet's URL: docs.google.com/spreadsheets/d/[SHEET_ID]/edit">
            <Input value={cfg.sheetId} onChange={e => set('sheetId', e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs..." />
          </Field>
          <Field label="Tab name">
            <Input value={cfg.sheetTab} onChange={e => set('sheetTab', e.target.value)} placeholder="Full Inventory" />
          </Field>
        </div>
        <Field label="Google API key"
          help="Create one at console.cloud.google.com → APIs → Google Sheets API → Credentials. The Sheet must be shared publicly or the API key must have Sheets access.">
          <Input type="password" value={cfg.gapiKey} onChange={e => set('gapiKey', e.target.value)} placeholder="AIza..." />
        </Field>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <Btn onClick={testSheet} disabled={testing === 'sheet' || !cfg.sheetId || !cfg.gapiKey}>
            {testing === 'sheet' ? 'Testing...' : 'Test Sheet connection'}
          </Btn>
        </div>
      </Card>

      <Card title="Google Sheets — additional sheets" icon="📊">
        <div className={styles.formGrid}>
          <Field label="Flow Inventory Sheet ID"
            help="Sheet ID for your Flow Tracker Google Sheet. Leave blank to use the same sheet as Apex.">
            <Input value={cfg.flowSheetId||''} onChange={e => set('flowSheetId', e.target.value)} placeholder="1ZQoS70OaTK9NS3Z5XGqplzpKlr_EXSwpUUcRp78NHZ8" />
          </Field>
          <Field label="Field Registry Sheet ID"
            help="Sheet ID for your Field Registry Google Sheet.">
            <Input value={cfg.fieldSheetId||''} onChange={e => set('fieldSheetId', e.target.value)} placeholder="1PcSHyluf62QCNn2rGZx4ZUhDbgiepCJS" />
          </Field>
        </div>
      </Card>

      <Card title="Analysis settings" icon="⚙️">
        <Field label="Batch size" help="How many files to analyse per batch. Smaller = slower but more reliable.">
          <Select value={cfg.batchSize} onChange={e => set('batchSize', e.target.value)}>
            <option value="10">10 files per batch</option>
            <option value="20">20 files per batch (recommended)</option>
            <option value="50">50 files per batch</option>
          </Select>
        </Field>
      </Card>

      <Card title="⚡ One-time setup — Deploy the proxy worker" icon="🚀">
        <p style={{ fontSize:13, color:'#475569', lineHeight:1.7, marginBottom:12 }}>
          The proxy worker sits between your browser and Salesforce to bypass CORS restrictions.
          Deploy it once in 3 minutes — it runs free forever on Cloudflare.
        </p>
        <ol style={{ paddingLeft:20 }}>
          {[
            <>Go to <a href="https://cloudflare.com" target="_blank" rel="noreferrer" style={{color:'#2E6DB4'}}>cloudflare.com</a> → sign up free → no credit card needed</>,
            <>In Terminal: <code style={{background:'#F1F5F9',padding:'2px 6px',borderRadius:4,fontFamily:'monospace'}}>npm install -g wrangler</code></>,
            <>Then: <code style={{background:'#F1F5F9',padding:'2px 6px',borderRadius:4,fontFamily:'monospace'}}>wrangler login</code> — opens Cloudflare in browser, click Allow</>,
            <>Download the worker zip below, unzip it, then in Terminal: <code style={{background:'#F1F5F9',padding:'2px 6px',borderRadius:4,fontFamily:'monospace'}}>cd sfdc-worker && npm install && npm run deploy</code></>,
            <>Done — come back here and click "Test Salesforce connection"</>,
          ].map((step, i) => (
            <li key={i} style={{ fontSize:13, color:'#1E293B', lineHeight:2, marginBottom:4 }}>{step}</li>
          ))}
        </ol>
        <div style={{ marginTop:12, padding:'10px 14px', background:'#EBF3FF', borderRadius:8, fontSize:13, color:'#1B3A6B' }}>
          ℹ️ The worker only forwards requests between your browser and Salesforce — it never stores your token or data.
        </div>
      </Card>

      <Card title="How to get your Salesforce token" icon="❓">
        <ol className={styles.instrList}>
          <li>Go to <strong>workbench.developerforce.com</strong></li>
          <li>Log in with your Salesforce credentials</li>
          <li>Click <strong>Info → Session Information</strong></li>
          <li>Copy the <strong>SessionId</strong> value</li>
          <li>Paste it in the Session token field above</li>
        </ol>
        <p style={{ fontSize: 13, color: 'var(--gray600)', marginTop: 12 }}>
          Tokens expire after a few hours. When the inventory refresh fails with a 401 error, just get a fresh token from Workbench and update it here.
        </p>
      </Card>

      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <Btn variant="primary" size="lg" onClick={save}>{saved ? '✓ Saved' : 'Save all settings'}</Btn>
        <Btn onClick={() => { if (window.confirm('Clear all stored settings and cached data?')) { localStorage.clear(); setCfg({ sfUrl:'', sfToken:'', sfVersion:'v66.0', anthropicKey:'', sheetId:'', sheetTab:'Full Inventory', gapiKey:'', batchSize:'20' }); }}}>
          Clear all data
        </Btn>
      </div>
    </div>
  );
}
