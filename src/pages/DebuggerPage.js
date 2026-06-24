import React, { useState } from 'react';
import { PageHeader, Card, Btn, Badge, Alert, Tabs, Field, Select, CodeBlock } from '../components/UI';
import { debugWithClaude, loadConfig } from '../utils/api';
import styles from './DebuggerPage.module.css';

const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function BugCard({ bug, index }) {
  const [open, setOpen] = useState(index === 0);
  const accentMap = { Critical: 'Red', High: 'Red', Medium: 'Amber', Low: 'Blue' };
  return (
    <div className={`${styles.bugCard} ${styles[`bug${bug.severity}`]}`}>
      <div className={styles.bugHeader} onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
        <Badge label={bug.severity} />
        <span className={styles.bugTitle}>{bug.title}</span>
        {bug.location && <span className={styles.bugLocation}>{bug.location}</span>}
        <span className={styles.bugToggle}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className={styles.bugBody}>
          <p className={styles.bugDesc}>{bug.description}</p>
          <div className={styles.fixSection}>
            <div className={styles.fixLabel}>✅  Fix</div>
            <p className={styles.bugDesc}>{bug.fix}</p>
            {bug.fixCode && <CodeBlock code={bug.fixCode} />}
          </div>
        </div>
      )}
    </div>
  );
}

function OptCard({ opt }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.optCard}>
      <div className={styles.bugHeader} onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
        <span className={styles.bugTitle}>{opt.title}</span>
        <span className={styles.bugLocation} style={{ color: '#1B5E20' }}>{opt.benefit}</span>
        <span className={styles.bugToggle}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className={styles.bugBody}>
          <p className={styles.bugDesc}>{opt.description}</p>
          {opt.code && <CodeBlock code={opt.code} />}
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result, code }) {
  const [tab, setTab] = useState('bugs');
  const bugs = (result.bugs || []).sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  return (
    <div>
      <div className={styles.resultSummary}>
        <div className={styles.summaryScore}>
          <div className={styles.scoreNum} style={{ color: result.overallScore >= 7 ? '#1B5E20' : result.overallScore >= 4 ? '#7D4E00' : '#8B0000' }}>
            {result.overallScore}/10
          </div>
          <div className={styles.scoreLabel}>Overall score</div>
          <Badge label={result.overallRating} />
        </div>
        <div className={styles.summaryText}>
          <p className={styles.summaryDesc}>{result.summary}</p>
          {result.governorRisks?.length > 0 && (
            <div className={styles.govRisks}>
              <strong>⚠ Governor limit risks:</strong> {result.governorRisks.join(' · ')}
            </div>
          )}
          {result.canBeFlow && result.canBeFlow !== 'Unlikely' && (
            <div className={styles.flowNote}>
              <strong>Flow replacement:</strong> <Badge label={result.canBeFlow} /> {result.flowNotes}
            </div>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'bugs', label: `🐛  Bugs & Issues (${bugs.length})` },
          { id: 'opts', label: `⚡  Optimisations (${(result.optimisations || []).length})` },
          { id: 'testing', label: '🧪  Testing' },
        ]}
        active={tab} onChange={setTab}
      />

      {tab === 'bugs' && (
        <div>
          {bugs.length === 0
            ? <Alert type="success">No bugs or issues found. The code looks clean!</Alert>
            : bugs.map((b, i) => <BugCard key={i} bug={b} index={i} />)
          }
        </div>
      )}

      {tab === 'opts' && (
        <div>
          {(result.optimisations || []).length === 0
            ? <Alert type="success">No optimisation suggestions — code is already well structured.</Alert>
            : (result.optimisations || []).map((o, i) => <OptCard key={i} opt={o} />)
          }
        </div>
      )}

      {tab === 'testing' && (
        <Card title="Testing notes" icon="🧪">
          <p className={styles.testingNotes}>{result.testingNotes || 'No specific testing notes.'}</p>
          {(result.recommendations || []).length > 0 && (
            <>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', margin: '16px 0 8px' }}>Additional recommendations</h4>
              <ul className={styles.recList}>
                {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export default function DebuggerPage() {
  const [code, setCode] = useState('');
  const [codeType, setCodeType] = useState('ApexClass');
  const [objective, setObjective] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const cfg = loadConfig();

  const run = async () => {
    if (!code.trim()) { setError('Paste some code first.'); return; }
    if (!objective.trim()) { setError('Describe what the code should do.'); return; }
    if (!cfg.anthropicKey) { setError('Anthropic API key required. Add it in Settings.'); return; }

    setRunning(true);
    setError('');
    setResult(null);

    try {
      const res = await debugWithClaude(code, codeType, objective, symptoms, cfg.anthropicKey);
      setResult(res);
    } catch (e) {
      setError(`Analysis failed: ${e.message}`);
    }
    setRunning(false);
  };

  const loadExample = () => {
    setCodeType('ApexTrigger');
    setObjective('This trigger should create a Renewal Opportunity when an Opportunity with RecordType = Renewal closes as Closed Won. It should only enqueue the job for the deals that actually closed, not all deals in the transaction.');
    setSymptoms('Invoices are being created for Opportunities that did not close. The renewal Opp name format is inconsistent — some have spaces around the dash, some do not. Failed renewals are not being flagged anywhere.');
    setCode(`trigger InvoiceOnClosedWonOpp on Opportunity (after update) {
    List<Opportunity> oppList = new List<Opportunity>();
    
    for (Opportunity opp : Trigger.new) {
        Opportunity oldOpp = Trigger.oldMap.get(opp.Id);
        if (opp.StageName == 'Closed Won' && oldOpp.StageName != 'Closed Won') {
            oppList.add(opp);
        }
    }
    
    if (!oppList.isEmpty()) {
        // BUG: passes ALL updated opps, not just the closed ones
        System.enqueueJob(new InvoiceOnClosedWonQueueable(Trigger.newMap.keySet()));
    }
}`);
  };

  return (
    <div>
      <PageHeader
        title="Apex Debugger & Optimiser"
        subtitle="Paste any Apex class, trigger, or Flow XML. Describe what it should do and any errors you're seeing. Get a full diagnosis with specific fixes."
      />

      <div className={styles.inputGrid}>
        <div className={styles.inputLeft}>
          <Card title="Code" icon="📄"
            action={<button className={styles.exampleBtn} onClick={loadExample}>Load example</button>}>
            <Field label="Code type">
              <Select value={codeType} onChange={e => setCodeType(e.target.value)}>
                <option value="ApexClass">Apex Class</option>
                <option value="ApexTrigger">Apex Trigger</option>
                <option value="Flow">Salesforce Flow (XML)</option>
              </Select>
            </Field>
            <textarea
              className={styles.codeArea}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={`// Paste your ${codeType} code here...`}
              spellCheck={false}
            />
            <div className={styles.codeFooter}>
              <span>{code.length} chars · {code.split('\n').length} lines</span>
            </div>
          </Card>
        </div>

        <div className={styles.inputRight}>
          <Card title="Context" icon="💬">
            <Field
              label="What should this code do?"
              help="Describe the intended behaviour in plain English. The more specific you are, the better the diagnosis.">
              <textarea
                className={styles.contextArea}
                value={objective}
                onChange={e => setObjective(e.target.value)}
                placeholder="e.g. This trigger should create a Renewal Opportunity on the Account when a Renewal deal closes as Closed Won. It should only fire for RecordType = Renewal, not New Business."
              />
            </Field>
            <Field
              label="Errors or symptoms observed (optional)"
              help="Paste error messages, describe unexpected behaviour, or leave blank for general review.">
              <textarea
                className={styles.contextArea}
                style={{ minHeight: 100 }}
                value={symptoms}
                onChange={e => setSymptoms(e.target.value)}
                placeholder="e.g. 'Too many SOQL queries: 101' when closing multiple deals. Renewal Opps are being created for deals that didn't close."
              />
            </Field>
          </Card>

          <Btn variant="primary" size="lg" onClick={run} disabled={running || !code.trim()}>
            {running
              ? <><span className={styles.spin}>⏳</span> Analysing...</>
              : '🔍  Analyse & debug'}
          </Btn>

          {!cfg.anthropicKey && (
            <Alert type="warning" style={{ marginTop: 12 }}>
              Anthropic API key not set. Add it in <strong>Settings</strong> to use the AI debugger.
            </Alert>
          )}
          {error && <Alert type="error" style={{ marginTop: 12 }}>{error}</Alert>}
        </div>
      </div>

      {running && (
        <Card title="Analysing..." icon="🔍">
          <div className={styles.loadingBox}>
            <div className={styles.loadingSpinner} />
            <p>Reading the code, identifying issues, and generating fixes...</p>
          </div>
        </Card>
      )}

      {result && !running && (
        <Card title="Analysis results" icon="📊">
          <ResultPanel result={result} code={code} />
        </Card>
      )}
    </div>
  );
}
