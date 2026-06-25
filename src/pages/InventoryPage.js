import React, { useState, useCallback } from 'react';
import { PageHeader, Card, Btn, Stat, Badge, StepRow, Alert, Tabs, Field, Select } from '../components/UI';
import { fetchApexFromSF, analyseLocally, analyseWithClaude, writeToSheet, loadConfig, getTimestamps, saveTimestamps } from '../utils/api';
import styles from './InventoryPage.module.css';

const STEPS = ['fetch', 'diff', 'analyse', 'sheet'];
const STEP_LABELS = {
  fetch:   ['Fetch from Salesforce', 'Querying Tooling API for all classes and triggers'],
  diff:    ['Detect changes', 'Compare with last run to find new and modified files'],
  analyse: ['Analyse each file', 'Description · objects · quality · Flow candidate · domain'],
  sheet:   ['Sync to Google Sheets', 'Update existing rows, add new rows'],
};

function StepList({ stepStates, stepSubs }) {
  return (
    <div>
      {STEPS.map((s, i) => (
        <StepRow key={s} num={i + 1} title={STEP_LABELS[s][0]}
          subtitle={stepSubs[s] || STEP_LABELS[s][1]}
          state={stepStates[s] || 'idle'} />
      ))}
    </div>
  );
}

function ResultTable({ results }) {
  const [search, setSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterQuality, setFilterQuality] = useState('');
  const [filterChange, setFilterChange] = useState('');

  const domains = [...new Set(results.map(r => r.domain).filter(Boolean))].sort();

  const filtered = results.filter(r => {
    const q = search.toLowerCase();
    if (search && !r.name.toLowerCase().includes(q) && !r.domain.toLowerCase().includes(q)) return false;
    if (filterDomain && r.domain !== filterDomain) return false;
    if (filterQuality && (r.qualityRating || r.rating) !== filterQuality) return false;
    if (filterChange && r.changeStatus !== filterChange) return false;
    return true;
  });

  return (
    <div>
      <div className={styles.filterRow}>
        <input className={styles.searchInput} placeholder="Search by name or domain..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={filterDomain} onChange={e => setFilterDomain(e.target.value)}>
          <option value="">All domains</option>
          {domains.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className={styles.filterSelect} value={filterQuality} onChange={e => setFilterQuality(e.target.value)}>
          <option value="">All quality</option>
          <option>Good</option><option>Needs Work</option><option>Poor</option>
        </select>
        <select className={styles.filterSelect} value={filterChange} onChange={e => setFilterChange(e.target.value)}>
          <option value="">All changes</option>
          <option>New</option><option>Changed</option><option>Unchanged</option>
        </select>
        <span className={styles.filterCount}>{filtered.length} of {results.length}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th><th>Type</th><th>Domain</th><th>Quality</th>
              <th>Gov Risk</th><th>Can Be Flow</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map(r => (
              <tr key={r.id || r.name}>
                <td className={styles.nameCell}>{r.name}</td>
                <td><span className={styles.typeTag}>{r.ftype === 'ApexTrigger' ? 'Trigger' : 'Class'}</span></td>
                <td>{r.domain}</td>
                <td><Badge label={r.qualityRating || r.rating} /></td>
                <td><span style={{ color: (r.hasGovernorRisk || r.hasGovRisk) ? '#8B0000' : '#1B5E20', fontWeight: 500, fontSize: 12 }}>
                  {(r.hasGovernorRisk || r.hasGovRisk) ? '⚠ YES' : '✓ No'}
                </span></td>
                <td><Badge label={r.canBeFlow} /></td>
                <td><Badge label={r.changeStatus || 'Analysed'} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className={styles.emptyRow}>No files match the current filters</td></tr>
            )}
            {filtered.length > 100 && (
              <tr><td colSpan={7} className={styles.emptyRow}>Showing first 100 of {filtered.length} — use filters to narrow down</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [running, setRunning] = useState(false);
  const [stepStates, setStepStates] = useState({});
  const [stepSubs, setStepSubs] = useState({});
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('all');
  const [depth, setDepth] = useState('full');
  const [tab, setTab] = useState('run');
  const [lastRun, setLastRun] = useState(null);

  const cfg = loadConfig();

  const setStep = useCallback((step, state, sub) => {
    setStepStates(p => ({ ...p, [step]: state }));
    if (sub) setStepSubs(p => ({ ...p, [step]: sub }));
  }, []);

  const addLog = useCallback((msg, type = '') => {
    setLogs(p => [...p, { msg, type, t: Date.now() }]);
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setError('');
    setLogs([]);
    setResults([]);
    setSummary(null);
    setStepStates({});
    setStepSubs({});

    try {
      // ── STEP 1: Fetch ────────────────────────────────────────────
      setStep('fetch', 'active');
      addLog('Connecting to Salesforce Tooling API...');

      if (!cfg.sfUrl || !cfg.sfToken) throw new Error('Salesforce URL and token required. Go to Settings.');

      const { classes, triggers } = await fetchApexFromSF(cfg);
      const allFiles = [
        ...classes.map(c => ({ ...c, ftype: 'ApexClass' })),
        ...triggers.map(t => ({ ...t, ftype: 'ApexTrigger' })),
      ];
      addLog(`✓ Fetched ${classes.length} classes + ${triggers.length} triggers (${allFiles.length} total)`, 'ok');
      setStep('fetch', 'done', `${classes.length} classes + ${triggers.length} triggers`);

      // ── STEP 2: Diff ─────────────────────────────────────────────
      setStep('diff', 'active');
      const prevTs = getTimestamps();
      let newCount = 0, changedCount = 0;

      allFiles.forEach(f => {
        const prev = prevTs[f.Name];
        if (!prev) { f.changeStatus = 'New'; newCount++; }
        else if (prev !== f.LastModifiedDate) { f.changeStatus = 'Changed'; changedCount++; }
        else { f.changeStatus = 'Unchanged'; }
      });

      const toProcess = scope === 'changed'
        ? allFiles.filter(f => f.changeStatus !== 'Unchanged')
        : allFiles;

      addLog(`✓ ${newCount} new · ${changedCount} changed · ${allFiles.length - newCount - changedCount} unchanged`, 'ok');
      setStep('diff', 'done', `${newCount} new · ${changedCount} changed`);

      // ── STEP 3: Analyse ──────────────────────────────────────────
      setStep('analyse', 'active', `Analysing ${toProcess.length} files...`);
      const analysed = [];
      let govRiskCount = 0;

      for (let i = 0; i < toProcess.length; i++) {
        const f = toProcess[i];
        setStepSubs(p => ({ ...p, analyse: `Analysing ${f.Name} (${i + 1}/${toProcess.length})...` }));

        let analysis = null;
        if (depth === 'full' && cfg.anthropicKey && f.Body?.length > 50) {
          try {
            analysis = await analyseWithClaude(f.Name, f.ftype, f.Body || '', cfg.anthropicKey);
          } catch (e) {
            addLog(`  ⚠ Claude failed for ${f.Name} — using local analysis`, 'warn');
          }
        }
        if (!analysis) {
          const local = analyseLocally(f.Name, f.ftype, f.Body || '');
          analysis = {
            description: local.description,
            domain: local.domain,
            objects: local.objects,
            fields: [],
            qualityRating: local.rating,
            qualityScore: local.score,
            qualityIssues: local.issues,
            qualityStrengths: '',
            canBeFlow: local.canBeFlow,
            flowReason: '',
            hasGovernorRisk: local.hasGovRisk,
            governorIssues: local.govRisks,
            recommendations: [],
          };
        }

        if (analysis.hasGovernorRisk) govRiskCount++;

        const row = {
          id: f.Id,
          name: f.Name,
          ftype: f.ftype,
          body: f.Body,
          isTest: analyseLocally(f.Name, f.ftype, f.Body || '').isTest,
          lastModified: f.LastModifiedDate,
          changeStatus: f.changeStatus,
          linesOfCode: (f.Body || '').split('\n').length,
          ...analysis,
        };
        analysed.push(row);

        const emoji = f.changeStatus === 'New' ? '+ ' : f.changeStatus === 'Changed' ? '~ ' : '  ';
        addLog(`${emoji}${f.Name} — ${analysis.qualityRating} · ${analysis.domain}`,
          analysis.qualityRating === 'Good' ? 'ok' : analysis.qualityRating === 'Poor' ? 'err' : '');

        await new Promise(r => setTimeout(r, 80));
      }

      // Save timestamps
      const newTs = { ...prevTs };
      allFiles.forEach(f => { newTs[f.Name] = f.LastModifiedDate; });
      saveTimestamps(newTs);

      setResults(analysed);
      try {
        localStorage.setItem('sfdc_apex_inventory', JSON.stringify(analysed));
        localStorage.setItem('sfdc_last_refresh', new Date().toISOString());
      } catch(e) {}
      setSummary({ total: allFiles.length, newCount, changedCount, govRiskCount, analysed: analysed.length });
      setStep('analyse', 'done', `${toProcess.length} files analysed`);

      // ── STEP 4: Sheet sync ───────────────────────────────────────
      setStep('sheet', 'active', 'Writing to Google Sheets...');
      if (cfg.sheetId && cfg.gapiKey) {
        try {
          await writeToSheet(cfg, analysed);
          addLog(`✓ Google Sheet updated — ${analysed.length} rows written`, 'ok');
          setStep('sheet', 'done', `${analysed.length} rows written to Google Sheet`);
        } catch (e) {
          addLog(`✗ Sheet write failed: ${e.message}`, 'err');
          setStep('sheet', 'error', 'Sheet write failed — check API key');
        }
      } else {
        addLog('ℹ Sheet not configured — add Sheet ID + API key in Settings', 'warn');
        setStep('sheet', 'done', 'Sheet not configured — results shown below only');
      }

      setLastRun(new Date().toLocaleTimeString());
      setTab('results');

    } catch (e) {
      setError(e.message);
      addLog(`✗ ${e.message}`, 'err');
      STEPS.forEach(s => { if (stepStates[s] === 'active') setStep(s, 'error'); });
    }

    setRunning(false);
  }, [scope, depth, cfg, setStep, addLog, stepStates]);

  const TABS = [
    { id: 'run',     label: '▶  Run' },
    { id: 'results', label: `📋  Results ${results.length ? `(${results.length})` : ''}` },
  ];

  return (
    <div>
      <PageHeader
        title="Apex Inventory"
        subtitle="Fetch all Apex classes and triggers from Salesforce, analyse each one, and sync to Google Sheets."
        action={lastRun && <span className={styles.lastRun}>Last run: {lastRun}</span>}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'run' && (
        <>
          <div className={styles.optRow}>
            <div style={{ flex: 1 }}>
              <Field label="Scope">
                <Select value={scope} onChange={e => setScope(e.target.value)}>
                  <option value="all">Everything — all classes and triggers</option>
                  <option value="classes">Apex classes only</option>
                  <option value="triggers">Apex triggers only</option>
                  <option value="changed">Changed since last run only</option>
                </Select>
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Analysis depth">
                <Select value={depth} onChange={e => setDepth(e.target.value)}>
                  <option value="full">Full AI analysis — description, objects, quality, Flow, domain</option>
                  <option value="local">Local analysis only — faster, no API key needed</option>
                </Select>
              </Field>
            </div>
          </div>

          {!cfg.sfToken && (
            <Alert type="warning">
              Salesforce token not configured. Go to <strong>Settings</strong> to add your connection details.
            </Alert>
          )}
          {!cfg.anthropicKey && depth === 'full' && (
            <Alert type="info">
              No Anthropic API key configured — will fall back to local analysis. Add it in Settings for full AI analysis.
            </Alert>
          )}

          <Btn variant="primary" size="lg" onClick={run} disabled={running}>
            {running ? '⏳  Running...' : '🔄  Refresh inventory'}
          </Btn>

          {(running || Object.keys(stepStates).length > 0) && (
            <Card title="Progress" icon="📊" style={{ marginTop: 20 }}>
              <StepList stepStates={stepStates} stepSubs={stepSubs} />
              {logs.length > 0 && (
                <div className={styles.logBox}>
                  {logs.slice(-40).map((l, i) => (
                    <div key={i} className={`${styles.logLine} ${l.type === 'ok' ? styles.logOk : l.type === 'err' ? styles.logErr : l.type === 'warn' ? styles.logWarn : ''}`}>
                      {l.msg}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {error && <Alert type="error">{error}</Alert>}
        </>
      )}

      {tab === 'results' && (
        <>
          {results.length === 0 ? (
            <Alert type="info">No results yet — run the inventory refresh first.</Alert>
          ) : (
            <>
              {summary && (
                <div className={styles.statGrid}>
                  <Stat label="Total files" value={summary.total} />
                  <Stat label="Analysed" value={summary.analysed} color="#1B3A6B" />
                  <Stat label="New" value={summary.newCount} color="#185FA5" />
                  <Stat label="Changed" value={summary.changedCount} color="#7D4E00" />
                  <Stat label="Gov risks" value={summary.govRiskCount} color="#8B0000" />
                  <Stat label="Flow candidates"
                    value={results.filter(r => ['Yes','Probably'].includes(r.canBeFlow)).length}
                    color="#1B5E20" />
                </div>
              )}
              <Card title="All files" icon="📋">
                <ResultTable results={results} />
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
