import React, { useState, useEffect, useRef } from 'react';
import { PageHeader, Card, Btn, Alert, Tabs, Field, Select } from '../components/UI';
import { loadConfig, callAI } from '../utils/api';
import styles from './AnalyserPage.module.css';

// ── helpers ───────────────────────────────────────────────────────────
function Badge({ label, color, bg }) {
  return (
    <span style={{
      display:'inline-block', padding:'2px 10px', borderRadius:99,
      fontSize:11, fontWeight:600, background: bg||'#EBF3FF', color: color||'#1B3A6B',
      marginRight:6, marginBottom:4, whiteSpace:'nowrap'
    }}>{label}</span>
  );
}

function SeverityIcon({ sev }) {
  const map = { Critical:'🔴', High:'🟠', Medium:'🟡', Low:'🔵' };
  return <span>{map[sev] || '⚪'}</span>;
}

function FileChip({ name, type, onRemove }) {
  const color = type === 'ApexTrigger' ? '#4A148C' : type === 'Flow' ? '#1B5E20' : '#1B3A6B';
  const bg    = type === 'ApexTrigger' ? '#F3E5F5' : type === 'Flow' ? '#D4EFDF' : '#EBF3FF';
  const icon  = type === 'ApexTrigger' ? '⚡' : type === 'Flow' ? '🔀' : '📦';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      background:bg, color, border:`1px solid ${color}33`,
      borderRadius:8, padding:'4px 10px', fontSize:12, fontWeight:500,
      marginRight:6, marginBottom:6
    }}>
      {icon} {name}
      {onRemove && (
        <button onClick={onRemove} style={{
          background:'none', border:'none', cursor:'pointer',
          color, fontSize:14, padding:0, lineHeight:1, marginLeft:2
        }}>×</button>
      )}
    </span>
  );
}

function StepIndicator({ step }) {
  const steps = [
    { n:1, label:'Describe process' },
    { n:2, label:'Review findings' },
    { n:3, label:'Fetch code' },
    { n:4, label:'Full analysis' },
  ];
  return (
    <div className={styles.stepIndicator}>
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div className={`${styles.stepDot} ${step >= s.n ? styles.stepDotActive : ''} ${step === s.n ? styles.stepDotCurrent : ''}`}>
            {step > s.n ? '✓' : s.n}
          </div>
          <div className={styles.stepLabel} style={{ color: step >= s.n ? '#1B3A6B' : '#94A3B8' }}>{s.label}</div>
          {i < steps.length - 1 && <div className={`${styles.stepLine} ${step > s.n ? styles.stepLineActive : ''}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── API calls — uses shared callAI helper (supports Portkey + Anthropic) ──

function parseJSON(text) {
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}') + 1;
  if (start < 0 || end <= start) throw new Error('No JSON found');
  return JSON.parse(text.slice(start, end));
}

async function fetchApexBody(sfUrl, sfVersion, sfToken, name, ftype) {
  const obj    = ftype === 'ApexTrigger' ? 'ApexTrigger' : 'ApexClass';
  const url    = `${sfUrl}/services/data/${sfVersion}/tooling/query?q=SELECT+Id,Name,Body+FROM+${obj}+WHERE+Name='${encodeURIComponent(name)}'`;
  const res    = await fetch(url, { headers: { Authorization: `Bearer ${sfToken}` } });
  if (!res.ok) throw new Error(`SF error ${res.status} for ${name}`);
  const data   = await res.json();
  return data.records?.[0]?.Body || '';
}

// ── Stage 1 — Discovery ───────────────────────────────────────────────
async function discoverRelevantFiles(query, inventory, flowList, fieldList, anthropicKey) {
  const apexSummary = inventory.slice(0, 120).map(f =>
    `${f.name} (${f.ftype||f.type}) — ${f.domain} — ${f.description||''} — Objects: ${Array.isArray(f.objects)?f.objects.join(','):f.objects||''}`
  ).join('\n');

  const flowSummary = flowList.slice(0, 100).map(f =>
    `${f.label} (${f.status}) — ${f.category} — ${f.triggerObject||''} — ${f.description||''}`
  ).join('\n');

  const fieldSummary = fieldList.slice(0, 80).map(f =>
    `${f.apiName} (${f.dataType}) — ${f.theme} — ${f.recommendation}`
  ).join('\n');

  const prompt = `You are a Salesforce RevOps expert. A user wants to understand and debug this business process:

"${query}"

Below is the inventory of all Apex files, Flows, and Fields in the Salesforce org. Identify which ones are relevant to this process.

APEX FILES (name, type, domain, description, objects):
${apexSummary}

FLOWS (name, status, category, object, description):
${flowSummary || 'No flow data loaded yet'}

FIELDS (apiName, dataType, theme, recommendation):
${fieldSummary || 'No field data loaded yet'}

Return ONLY valid JSON:
{
  "processTitle": "short name for this process (e.g. 'Renewal Opportunity Creation')",
  "processSummary": "2-3 sentence plain English summary of what this process does",
  "apexFiles": [
    { "name": "ExactFileName", "ftype": "ApexClass or ApexTrigger", "role": "what role it plays in this process", "priority": "Critical, Important, or Supporting" }
  ],
  "flows": [
    { "name": "Flow Label", "role": "what role it plays", "status": "Active or Inactive" }
  ],
  "fields": [
    { "name": "Field_API_Name__c", "object": "Account or Opportunity etc", "role": "what role it plays" }
  ],
  "executionOrder": ["step 1 description", "step 2 description", "step 3..."],
  "knownRisks": ["risk 1", "risk 2"],
  "questionsToInvestigate": ["question 1", "question 2"]
}`;

  const text = await callAI(prompt, anthropicKey, 3000);
  return parseJSON(text);
}

// ── Stage 2 — Deep multi-file analysis ───────────────────────────────
async function deepAnalysis(query, codeFiles, discovery, anthropicKey) {
  const codeSection = codeFiles.map(f =>
    `\n${'='.repeat(60)}\nFILE: ${f.name} (${f.ftype})\nROLE: ${f.role}\n${'='.repeat(60)}\n${(f.body||'').substring(0, 3000)}`
  ).join('\n');

  const prompt = `You are a senior Salesforce developer and RevOps expert. Analyse this connected system of Apex code and Flows for the following business process:

PROCESS: "${query}"

EXECUTION ORDER (from discovery):
${(discovery.executionOrder||[]).map((s,i)=>`${i+1}. ${s}`).join('\n')}

FLOWS INVOLVED:
${(discovery.flows||[]).map(f=>`- ${f.name} (${f.status}): ${f.role}`).join('\n')}

FIELDS INVOLVED:
${(discovery.fields||[]).map(f=>`- ${f.name} on ${f.object}: ${f.role}`).join('\n')}

ACTUAL CODE (${codeFiles.length} files):
${codeSection}

Analyse the ENTIRE system as one connected process. Return ONLY valid JSON:
{
  "summary": "3-4 sentence plain English explanation of how this entire process works end-to-end",
  "executionChain": [
    { "step": 1, "file": "FileName", "method": "methodName if applicable", "what": "plain English description of what happens at this step", "callsNext": "what it calls next or null" }
  ],
  "bugs": [
    {
      "severity": "Critical, High, Medium, or Low",
      "title": "short title",
      "file": "which file",
      "description": "what is wrong",
      "impact": "real-world impact on the business process",
      "fix": "exact fix description",
      "fixCode": "corrected code snippet or null"
    }
  ],
  "crossFileIssues": [
    {
      "title": "issue that spans multiple files",
      "filesInvolved": ["file1", "file2"],
      "description": "what the cross-file issue is",
      "fix": "how to fix it"
    }
  ],
  "optimisations": [
    { "title": "short title", "description": "improvement", "benefit": "what it improves" }
  ],
  "flowReplacementCandidates": [
    { "apexFile": "file name", "reason": "why it could be a Flow", "effort": "Low, Medium, or High" }
  ],
  "testingChecklist": ["test case 1", "test case 2"],
  "overallHealthScore": 1-10,
  "overallHealthRating": "Good, Needs Work, or Poor"
}`;

  const text = await callAI(prompt, anthropicKey, 4000);
  return parseJSON(text);
}

// ── Result display ────────────────────────────────────────────────────
function DiscoveryResult({ result, onProceed, onAddFile, onRemoveFile, selectedFiles, fetching }) {
  const allApex = result.apexFiles || [];
  const critical = allApex.filter(f => f.priority === 'Critical');
  const important = allApex.filter(f => f.priority === 'Important');
  const supporting = allApex.filter(f => f.priority === 'Supporting');

  return (
    <div>
      <div className={styles.discoveryHeader}>
        <div>
          <h2 className={styles.discoveryTitle}>{result.processTitle}</h2>
          <p className={styles.discoverySummary}>{result.processSummary}</p>
        </div>
      </div>

      {/* Execution order */}
      <Card title="How this process works — execution order" icon="🔗">
        <div className={styles.execChain}>
          {(result.executionOrder||[]).map((step, i) => (
            <div key={i} className={styles.execStep}>
              <div className={styles.execNum}>{i+1}</div>
              <div className={styles.execText}>{step}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Files to analyse */}
      <Card title="Apex files identified — select which to fetch and analyse" icon="⚡">
        <p className={styles.selectHint}>
          Tick the files you want included in the deep analysis.
          Critical files are pre-selected. More files = more thorough analysis but takes longer.
        </p>

        {[['🔴 Critical — must analyse', critical], ['🟠 Important', important], ['⚪ Supporting', supporting]].map(([label, files]) =>
          files.length > 0 && (
            <div key={label} className={styles.fileGroup}>
              <div className={styles.fileGroupLabel}>{label}</div>
              {files.map(f => {
                const isSelected = selectedFiles.some(s => s.name === f.name);
                return (
                  <div key={f.name}
                    className={`${styles.fileRow} ${isSelected ? styles.fileRowSelected : ''}`}
                    onClick={() => isSelected ? onRemoveFile(f.name) : onAddFile(f)}>
                    <input type="checkbox" readOnly checked={isSelected} className={styles.fileCheck} />
                    <div>
                      <div className={styles.fileName}>
                        <FileChip name={f.name} type={f.ftype} />
                      </div>
                      <div className={styles.fileRole}>{f.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:12 }}>
          <Btn variant="primary" onClick={onProceed} disabled={selectedFiles.length === 0 || fetching}>
            {fetching
              ? `⏳ Fetching ${selectedFiles.length} files from Salesforce...`
              : `🔍 Fetch & analyse ${selectedFiles.length} file${selectedFiles.length!==1?'s':''}`}
          </Btn>
          <span style={{ fontSize:12, color:'#94A3B8' }}>
            {selectedFiles.length} file{selectedFiles.length!==1?'s':''} selected
          </span>
        </div>
      </Card>

      {/* Flows */}
      {(result.flows||[]).length > 0 && (
        <Card title="Flows involved in this process" icon="🔀">
          {result.flows.map((f,i) => (
            <div key={i} className={styles.flowRow}>
              <Badge label={f.status} color={f.status==='Active'?'#1B5E20':'#7D4E00'} bg={f.status==='Active'?'#D4EFDF':'#FEF3CD'} />
              <div>
                <div className={styles.flowName}>{f.name}</div>
                <div className={styles.flowRole}>{f.role}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Fields */}
      {(result.fields||[]).length > 0 && (
        <Card title="Key fields involved" icon="🏷️">
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {result.fields.map((f,i) => (
              <div key={i} className={styles.fieldChip}>
                <div className={styles.fieldChipName}>{f.name}</div>
                <div className={styles.fieldChipSub}>{f.object} · {f.role}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Known risks */}
      {(result.knownRisks||[]).length > 0 && (
        <Alert type="warning">
          <strong>Known risks to investigate:</strong>
          <ul style={{ margin:'8px 0 0 16px' }}>
            {result.knownRisks.map((r,i) => <li key={i} style={{ fontSize:13, marginBottom:4 }}>{r}</li>)}
          </ul>
        </Alert>
      )}
    </div>
  );
}

function DeepResult({ result }) {
  const [activeTab, setActiveTab] = useState('chain');
  const bugs = (result.bugs||[]).sort((a,b) => {
    const o = {Critical:0,High:1,Medium:2,Low:3};
    return (o[a.severity]||9)-(o[b.severity]||9);
  });

  const tabs = [
    { id:'chain', label:`🔗 How it works` },
    { id:'bugs',  label:`🐛 Bugs (${bugs.length})` },
    { id:'cross', label:`🔀 Cross-file issues (${(result.crossFileIssues||[]).length})` },
    { id:'opts',  label:`⚡ Optimisations` },
    { id:'test',  label:`🧪 Testing` },
  ];

  return (
    <div>
      <div className={styles.deepHeader}>
        <div className={styles.deepScore}
          style={{ color: result.overallHealthScore>=7?'#1B5E20':result.overallHealthScore>=4?'#7D4E00':'#8B0000' }}>
          {result.overallHealthScore}/10
        </div>
        <div>
          <div className={styles.deepRating}>{result.overallHealthRating} — {result.overallHealthScore>=7?'This process is well built':'This process has issues that need attention'}</div>
          <p className={styles.deepSummary}>{result.summary}</p>
        </div>
      </div>

      <div className={styles.subTabs}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`${styles.subTab} ${activeTab===t.id?styles.subTabActive:''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'chain' && (
        <Card title="Full execution chain — step by step" icon="🔗">
          {(result.executionChain||[]).map((step, i) => (
            <div key={i} className={styles.chainStep}>
              <div className={styles.chainNum}>{step.step}</div>
              <div className={styles.chainBody}>
                <div className={styles.chainFile}>
                  <FileChip name={step.file} type={step.file?.includes('Trigger')||step.file?.includes('trigger')?'ApexTrigger':'ApexClass'} />
                  {step.method && <span className={styles.chainMethod}>.{step.method}()</span>}
                </div>
                <div className={styles.chainWhat}>{step.what}</div>
                {step.callsNext && (
                  <div className={styles.chainNext}>↓ calls: {step.callsNext}</div>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      {activeTab === 'bugs' && (
        <div>
          {bugs.length === 0 && <Alert type="success">No bugs found across the analysed files.</Alert>}
          {bugs.map((bug, i) => (
            <div key={i} className={`${styles.bugCard} ${styles[`bug${bug.severity}`]}`}>
              <div className={styles.bugHeader}>
                <SeverityIcon sev={bug.severity} />
                <span className={styles.bugSev}>{bug.severity}</span>
                <span className={styles.bugTitle}>{bug.title}</span>
                <FileChip name={bug.file} type={bug.file?.includes('Trigger')?'ApexTrigger':'ApexClass'} />
              </div>
              <div className={styles.bugBody}>
                <p className={styles.bugDesc}>{bug.description}</p>
                <div className={styles.bugImpact}><strong>Business impact:</strong> {bug.impact}</div>
                <div className={styles.bugFix}><strong>Fix:</strong> {bug.fix}</div>
                {bug.fixCode && (
                  <pre className={styles.bugCode}><code>{bug.fixCode}</code></pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'cross' && (
        <div>
          {(result.crossFileIssues||[]).length === 0 && <Alert type="success">No cross-file issues found.</Alert>}
          {(result.crossFileIssues||[]).map((issue, i) => (
            <Card key={i} title={issue.title} icon="🔀" accent="Amber">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                {(issue.filesInvolved||[]).map(f => <FileChip key={f} name={f} type="ApexClass" />)}
              </div>
              <p style={{ fontSize:13, color:'#475569', marginBottom:10 }}>{issue.description}</p>
              <div style={{ background:'#D4EFDF', borderRadius:8, padding:'10px 14px' }}>
                <strong style={{ fontSize:12, color:'#1B5E20' }}>Fix:</strong>
                <p style={{ fontSize:13, color:'#1E293B', marginTop:4 }}>{issue.fix}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'opts' && (
        <div>
          {(result.optimisations||[]).map((opt, i) => (
            <Card key={i} title={opt.title} icon="⚡" accent="Blue">
              <p style={{ fontSize:13, color:'#475569', marginBottom:8 }}>{opt.description}</p>
              <Badge label={`Benefit: ${opt.benefit}`} color="#1B3A6B" bg="#EBF3FF" />
            </Card>
          ))}
          {(result.flowReplacementCandidates||[]).length > 0 && (
            <Card title="Flow replacement opportunities" icon="🔀">
              {result.flowReplacementCandidates.map((c,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #F1F5F9' }}>
                  <FileChip name={c.apexFile} type="ApexClass" />
                  <div style={{ flex:1, fontSize:13, color:'#475569' }}>{c.reason}</div>
                  <Badge label={`Effort: ${c.effort}`}
                    color={c.effort==='Low'?'#1B5E20':c.effort==='High'?'#8B0000':'#7D4E00'}
                    bg={c.effort==='Low'?'#D4EFDF':c.effort==='High'?'#FDECEA':'#FEF3CD'} />
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {activeTab === 'test' && (
        <Card title="Testing checklist" icon="🧪">
          {(result.testingChecklist||[]).map((t,i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'8px 0', borderBottom:'1px solid #F1F5F9', alignItems:'flex-start' }}>
              <span style={{ fontSize:16 }}>☐</span>
              <span style={{ fontSize:13, color:'#475569' }}>{t}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Multi-file debugger ───────────────────────────────────────────────
function MultiFileDebugger({ inventory, cfg }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [objective, setObjective] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [fetchLog, setFetchLog] = useState([]);

  const apexFiles = inventory.filter(f => !f.isTest && f.isTest !== 'Yes');

  const addFile = (f) => {
    if (!selectedFiles.find(s => s.name === f.name)) {
      setSelectedFiles(p => [...p, { name: f.name, ftype: f.ftype || f.type, role: f.description || '' }]);
    }
  };
  const removeFile = (name) => setSelectedFiles(p => p.filter(s => s.name !== name));

  const run = async () => {
    if (selectedFiles.length === 0) { setError('Select at least one file.'); return; }
    if (!objective) { setError('Describe what the process should do.'); return; }
    if (!cfg.anthropicKey) { setError('Add your Anthropic API key in Settings.'); return; }

    setRunning(true); setError(''); setResult(null); setFetchLog([]);

    try {
      // Fetch code for all selected files
      const codeFiles = [];
      for (const f of selectedFiles) {
        setFetchLog(p => [...p, `Fetching ${f.name}...`]);
        if (cfg.sfToken && cfg.sfUrl) {
          try {
            const body = await fetchApexBody(cfg.sfUrl, cfg.sfVersion||'v66.0', cfg.sfToken, f.name, f.ftype);
            codeFiles.push({ ...f, body });
            setFetchLog(p => [...p.slice(0,-1), `✓ ${f.name} (${body.split('\n').length} lines)`]);
          } catch(e) {
            setFetchLog(p => [...p.slice(0,-1), `⚠ ${f.name} — could not fetch (${e.message})`]);
            codeFiles.push({ ...f, body: `// Could not fetch: ${e.message}` });
          }
        } else {
          codeFiles.push({ ...f, body: `// Salesforce not connected — add token in Settings` });
          setFetchLog(p => [...p.slice(0,-1), `⚠ ${f.name} — Salesforce not connected`]);
        }
        await new Promise(r => setTimeout(r, 200));
      }

      setFetchLog(p => [...p, '🤖 Sending to Claude for analysis...']);
      const analysis = await deepAnalysis(objective, codeFiles, { flows:[], fields:[], executionOrder:[] }, cfg.anthropicKey);
      setResult(analysis);
    } catch(e) {
      setError('Analysis failed: ' + e.message);
    }
    setRunning(false);
  };

  return (
    <div>
      <div className={styles.multiGrid}>
        {/* Left — file selector */}
        <div>
          <Card title="Select files to analyse together" icon="📁">
            <p className={styles.selectHint}>
              Pick all Apex files involved in the process. The tool fetches the actual code from Salesforce and analyses them as one connected system.
            </p>
            <div className={styles.selectedChips}>
              {selectedFiles.map(f => (
                <FileChip key={f.name} name={f.name} type={f.ftype} onRemove={() => removeFile(f.name)} />
              ))}
              {selectedFiles.length === 0 && <span style={{ fontSize:12, color:'#94A3B8' }}>No files selected yet</span>}
            </div>

            <div className={styles.fileSearch}>
              <div className={styles.fileListScroll}>
                {apexFiles.slice(0, 100).map(f => {
                  const isSelected = selectedFiles.some(s => s.name === f.name);
                  return (
                    <div key={f.name}
                      className={`${styles.filePickRow} ${isSelected?styles.filePickSelected:''}`}
                      onClick={() => isSelected ? removeFile(f.name) : addFile(f)}>
                      <input type="checkbox" readOnly checked={isSelected} className={styles.fileCheck} />
                      <div>
                        <div style={{ fontSize:12, fontWeight:500, color:'#1B3A6B', fontFamily:'var(--font-mono)' }}>{f.name}</div>
                        <div style={{ fontSize:11, color:'#94A3B8' }}>{f.ftype||f.type} · {f.domain}</div>
                      </div>
                    </div>
                  );
                })}
                {apexFiles.length === 0 && (
                  <p style={{ fontSize:13, color:'#94A3B8', padding:12 }}>
                    Run the Apex Inventory refresh first to populate this list.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right — context */}
        <div>
          <Card title="Describe the problem" icon="💬">
            <Field label="What should this process do?"
              help="Describe the intended end-to-end behaviour. The more specific, the better the analysis.">
              <textarea className={styles.textArea} value={objective}
                onChange={e => setObjective(e.target.value)}
                placeholder="e.g. When a Renewal Opportunity closes as Closed Won, the system should create the next Renewal Opportunity, stamp Latest_Won_Renewal__c on the Account, create an Invoice, and update the Contract CPQ fields. Currently renewals are sometimes not being created and we have no visibility when it fails." />
            </Field>
            <Field label="Symptoms or errors observed (optional)"
              help="Paste any error messages or describe unexpected behaviour.">
              <textarea className={styles.textArea} style={{ minHeight:100 }} value={symptoms}
                onChange={e => setSymptoms(e.target.value)}
                placeholder="e.g. Renewals missing for some accounts. No error in SF. Support team noticed the issue 2 weeks after deals closed." />
            </Field>
            <Btn variant="primary" size="lg" onClick={run} disabled={running||selectedFiles.length===0}>
              {running ? '⏳ Analysing...' : `🔍 Analyse ${selectedFiles.length} file${selectedFiles.length!==1?'s':''} together`}
            </Btn>
            {error && <Alert type="error" style={{ marginTop:12 }}>{error}</Alert>}
          </Card>

          {fetchLog.length > 0 && (
            <Card title="Progress" icon="📊">
              <div className={styles.fetchLog}>
                {fetchLog.map((l,i) => (
                  <div key={i} style={{ fontSize:12, fontFamily:'var(--font-mono)', color: l.startsWith('✓')?'#1B5E20':l.startsWith('⚠')?'#7D4E00':'#94A3B8', marginBottom:4 }}>{l}</div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {result && !running && (
        <div style={{ marginTop:20 }}>
          <h3 style={{ fontSize:16, fontWeight:700, color:'#1B3A6B', marginBottom:16 }}>Analysis results — {selectedFiles.length} files analysed as one system</h3>
          <DeepResult result={result} />
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────
export default function AnalyserPage() {
  const [tab, setTab] = useState('process');
  const [query, setQuery] = useState('');
  const [step, setStep] = useState(1);
  const [discovering, setDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [deepResult, setDeepResult] = useState(null);
  const [error, setError] = useState('');
  const [inventory, setInventory] = useState([]);
  const [flows, setFlows] = useState([]);
  const [fields, setFields] = useState([]);

  const cfg = loadConfig();

  useEffect(() => {
    try {
      const inv = localStorage.getItem('sfdc_apex_inventory');
      if (inv) setInventory(JSON.parse(inv));
      const fl = localStorage.getItem('sfdc_flows_cache');
      if (fl) setFlows(JSON.parse(fl));
      const fd = localStorage.getItem('sfdc_fields_cache');
      if (fd) setFields(JSON.parse(fd));
    } catch(e) {}
  }, []);

  const QUICK_EXAMPLES = [
    'How does a Renewal Opportunity get created when a deal closes?',
    'Why is the Subscription Status showing as Prospect for paying customers?',
    'How does invoice creation work when an Opportunity closes as Closed Won?',
    'How does CS assignment work when a new Opportunity is created?',
    'What happens when a renewal attempt closes as Closed/Lost?',
  ];

  const runDiscovery = async () => {
    if (!query.trim()) { setError('Describe the process you want to analyse.'); return; }
    if (!cfg.anthropicKey) { setError('Add your Anthropic API key in Settings.'); return; }
    if (inventory.length === 0) { setError('Run the Apex Inventory refresh first — the Process Analyser needs the inventory to find relevant files.'); return; }

    setDiscovering(true); setError(''); setDiscovery(null); setDeepResult(null); setSelectedFiles([]);

    try {
      const result = await discoverRelevantFiles(query, inventory, flows, fields, cfg.anthropicKey);
      setDiscovery(result);
      // Auto-select critical files
      const critical = (result.apexFiles||[]).filter(f => f.priority === 'Critical');
      setSelectedFiles(critical);
      setStep(2);
    } catch(e) {
      setError('Discovery failed: ' + e.message);
    }
    setDiscovering(false);
  };

  const runDeepAnalysis = async () => {
    if (selectedFiles.length === 0) { setError('Select at least one file.'); return; }
    setFetching(true); setError(''); setDeepResult(null);

    try {
      const codeFiles = [];
      for (const f of selectedFiles) {
        if (cfg.sfToken && cfg.sfUrl) {
          try {
            const body = await fetchApexBody(cfg.sfUrl, cfg.sfVersion||'v66.0', cfg.sfToken, f.name, f.ftype);
            codeFiles.push({ ...f, body });
          } catch(e) {
            codeFiles.push({ ...f, body: `// Could not fetch from Salesforce: ${e.message}` });
          }
        } else {
          codeFiles.push({ ...f, body: '// Connect Salesforce in Settings to fetch live code' });
        }
        await new Promise(r => setTimeout(r, 300));
      }
      setStep(3);
      const result = await deepAnalysis(query, codeFiles, discovery, cfg.anthropicKey);
      setDeepResult(result);
      setStep(4);
    } catch(e) {
      setError('Deep analysis failed: ' + e.message);
    }
    setFetching(false);
  };

  const reset = () => { setStep(1); setDiscovery(null); setDeepResult(null); setSelectedFiles([]); setError(''); };

  const TABS = [
    { id:'process', label:'🔍 Process Analyser' },
    { id:'multifile', label:'📁 Multi-file Debugger' },
  ];

  return (
    <div>
      <PageHeader
        title="Process Analyser & Multi-file Debugger"
        subtitle="Understand and debug entire business processes across Apex, Flows, and Fields — not just one file at a time."
      />

      <Tabs tabs={TABS} active={tab} onChange={(t) => { setTab(t); reset(); }} />

      {tab === 'process' && (
        <>
          <StepIndicator step={step} />

          {step === 1 && (
            <Card title="Describe the business process you want to understand or debug" icon="🔍">
              {inventory.length === 0 && (
                <Alert type="warning">
                  The Apex Inventory is empty — run a refresh on the <strong>Apex</strong> tab first.
                  The Process Analyser uses your inventory to find which files are relevant.
                </Alert>
              )}
              <Field label="What process do you want to analyse?"
                help="Describe it in plain English — no technical knowledge needed. The tool will find all the Apex, Flows, and Fields connected to it.">
                <textarea className={styles.textArea} value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="e.g. How does a Renewal Opportunity get created when a deal closes as Closed Won? Why are some renewals missing?"
                />
              </Field>

              <div className={styles.examples}>
                <div className={styles.examplesLabel}>Quick examples — click to use:</div>
                {QUICK_EXAMPLES.map((ex, i) => (
                  <button key={i} className={styles.exampleBtn} onClick={() => setQuery(ex)}>{ex}</button>
                ))}
              </div>

              <div style={{ marginTop:16 }}>
                <Btn variant="primary" size="lg" onClick={runDiscovery} disabled={discovering||!query.trim()}>
                  {discovering ? '⏳ Scanning inventory...' : '🔍 Find all connected files & flows'}
                </Btn>
              </div>

              {error && <Alert type="error" style={{ marginTop:12 }}>{error}</Alert>}
            </Card>
          )}

          {step >= 2 && discovery && !deepResult && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h3 style={{ fontSize:15, fontWeight:600, color:'#1B3A6B' }}>
                  Found {(discovery.apexFiles||[]).length} Apex files · {(discovery.flows||[]).length} Flows · {(discovery.fields||[]).length} Fields
                </h3>
                <Btn onClick={reset} size="sm">← New query</Btn>
              </div>
              <DiscoveryResult
                result={discovery}
                selectedFiles={selectedFiles}
                onAddFile={f => setSelectedFiles(p => [...p, f])}
                onRemoveFile={name => setSelectedFiles(p => p.filter(s => s.name !== name))}
                onProceed={runDeepAnalysis}
                fetching={fetching}
              />
              {error && <Alert type="error">{error}</Alert>}
            </>
          )}

          {step === 4 && deepResult && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h3 style={{ fontSize:15, fontWeight:600, color:'#1B3A6B' }}>
                  Deep analysis — {selectedFiles.length} files analysed as one connected system
                </h3>
                <Btn onClick={reset} size="sm">← New query</Btn>
              </div>
              <DeepResult result={deepResult} />
            </>
          )}
        </>
      )}

      {tab === 'multifile' && (
        <MultiFileDebugger inventory={inventory} cfg={cfg} />
      )}
    </div>
  );
}
