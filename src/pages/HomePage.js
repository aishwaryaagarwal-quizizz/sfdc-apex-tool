import React, { useState } from 'react';
import styles from './HomePage.module.css';

function Section({ id, icon, title, children }) {
  return (
    <div className={styles.section} id={id}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>{icon}</span>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Step({ num, title, children }) {
  return (
    <div className={styles.step}>
      <div className={styles.stepNum}>{num}</div>
      <div className={styles.stepBody}>
        <div className={styles.stepTitle}>{title}</div>
        <div className={styles.stepContent}>{children}</div>
      </div>
    </div>
  );
}

function ConceptCard({ icon, title, description, example }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.conceptCard}>
      <div className={styles.conceptHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.conceptIcon}>{icon}</span>
        <div className={styles.conceptTitles}>
          <div className={styles.conceptTitle}>{title}</div>
          <div className={styles.conceptDesc}>{description}</div>
        </div>
        <span className={styles.conceptToggle}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className={styles.conceptExample}>
          <div className={styles.conceptExampleLabel}>Real example:</div>
          <p>{example}</p>
        </div>
      )}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.faqItem}>
      <div className={styles.faqQ} onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span className={styles.faqToggle}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div className={styles.faqA}>{a}</div>}
    </div>
  );
}

function NavCard({ icon, title, desc, badge, href }) {
  return (
    <a href={href} className={styles.navCard}>
      <div className={styles.navCardIcon}>{icon}</div>
      <div className={styles.navCardBody}>
        <div className={styles.navCardTitle}>{title}
          {badge && <span className={styles.navCardBadge}>{badge}</span>}
        </div>
        <div className={styles.navCardDesc}>{desc}</div>
      </div>
      <span className={styles.navCardArrow}>→</span>
    </a>
  );
}

export default function HomePage() {
  return (
    <div className={styles.page}>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroBadge}>Built for Quizizz RevOps · No coding knowledge required</div>
          <h1 className={styles.heroTitle}>Your Salesforce Apex<br />Management Tool</h1>
          <p className={styles.heroSub}>
            This tool helps you understand, organise, and fix the Apex code
            running inside your Salesforce org — even if you have never written
            a single line of code.
          </p>
          <div className={styles.heroActions}>
            <a href="#/settings" className={styles.heroBtnPrimary}>Get started → Settings</a>
            <a href="#what-is-apex" className={styles.heroBtnSecondary}>What is Apex?</a>
          </div>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.heroCard}>
            <div className={styles.heroCardRow}>
              <span className={styles.heroCardLabel}>Total Apex files in your org</span>
              <span className={styles.heroCardVal}>131</span>
            </div>
            <div className={styles.heroCardRow}>
              <span className={styles.heroCardLabel}>Files with issues</span>
              <span className={styles.heroCardVal} style={{color:'#8B0000'}}>76</span>
            </div>
            <div className={styles.heroCardRow}>
              <span className={styles.heroCardLabel}>Flow replacement candidates</span>
              <span className={styles.heroCardVal} style={{color:'#1B5E20'}}>25</span>
            </div>
            <div className={styles.heroCardRow}>
              <span className={styles.heroCardLabel}>Governor limit risks</span>
              <span className={styles.heroCardVal} style={{color:'#E65100'}}>18</span>
            </div>
            <div className={styles.heroCardNote}>↑ Example from the Quizizz org. Run the Inventory to see your live numbers.</div>
          </div>
        </div>
      </div>

      {/* Nav cards */}
      <div className={styles.navCards}>
        <NavCard href="#/inventory" icon="📋" title="Inventory"
          badge="Start here"
          desc="See every Apex class and trigger in your org. Understand what each one does, which objects it touches, and whether it has issues." />
        <NavCard href="#/debugger" icon="🔍" title="Debugger"
          desc="Paste any piece of Apex code, describe what it should do, and get a plain-English diagnosis with exact fixes." />
        <NavCard href="#/settings" icon="⚙️" title="Settings"
          desc="Connect your Salesforce org and Google Sheet. Takes 5 minutes. You only need to do this once." />
      </div>

      {/* What is Apex */}
      <Section id="what-is-apex" icon="💡" title="What is Apex? — Plain English">
        <p className={styles.sectionIntro}>
          Apex is code that lives inside Salesforce and runs automatically when things happen —
          like when a deal closes or a contact is created. You cannot see it by clicking around
          in Salesforce — it runs behind the scenes. Think of it as the plumbing behind the walls.
        </p>
        <div className={styles.conceptGrid}>
          <ConceptCard
            icon="⚡"
            title="Apex Trigger"
            description="Code that fires automatically when a Salesforce record is created, updated, or deleted."
            example="When an Opportunity is marked Closed Won → a Trigger fires → it creates a Renewal Opportunity automatically. You never clicked anything — the Trigger did it."
          />
          <ConceptCard
            icon="📦"
            title="Apex Class"
            description="A file of reusable code that contains the actual logic. Triggers usually call a Class to do the work."
            example="InvoiceOnClosedWonOppHandler is a Class. It contains the instructions for how to build an Invoice record. The Trigger calls this Class and says 'go build the invoice now'."
          />
          <ConceptCard
            icon="🧪"
            title="Test Class"
            description="Code that checks whether the real code works correctly. Salesforce requires these before you can deploy changes."
            example="opportunityTrigger_HelperTest is a Test Class. It pretends to close a deal and checks that a Renewal Opp was created correctly. If this test fails, your deployment is blocked."
          />
          <ConceptCard
            icon="🚦"
            title="Governor Limits"
            description="Salesforce enforces strict limits on how much each piece of code can do in one transaction."
            example="You can only run 100 database queries per transaction. If a Trigger runs a query inside a loop, it can hit this limit and crash — throwing 'Too many SOQL queries: 101'. This tool flags those risks automatically."
          />
          <ConceptCard
            icon="🔄"
            title="Salesforce Flow"
            description="A visual, no-code alternative to Apex. You build flows by dragging and dropping boxes instead of writing code."
            example="Instead of a Trigger that stamps a field on close, you can build a Flow that does the same thing — and any admin can read and edit it without coding knowledge."
          />
          <ConceptCard
            icon="📊"
            title="Tooling API"
            description="A special Salesforce interface that lets tools like this one read your Apex code programmatically."
            example="When you click 'Refresh Inventory', this tool calls the Tooling API asking 'give me all Apex classes'. Salesforce sends back the code and this tool analyses it."
          />
        </div>
      </Section>

      {/* How to use */}
      <Section icon="🚀" title="How to Use This Tool — Step by Step">
        <Step num="1" title="Connect your Salesforce org (one time only)">
          Go to <strong>Settings</strong> and add:
          <ul className={styles.stepList}>
            <li><strong>Salesforce Instance URL</strong> — this is <code>https://quizizz.my.salesforce.com</code></li>
            <li><strong>Session token</strong> — get this from Workbench (see below)</li>
            <li><strong>Anthropic API key</strong> — this is what powers the AI analysis</li>
            <li><strong>Google Sheet ID</strong> — so results sync to your spreadsheet automatically</li>
          </ul>
          <div className={styles.stepTip}>
            💡 <strong>Getting a session token from Workbench:</strong> Go to workbench.developerforce.com → log in → click Info → Session Information → copy the SessionId value. Tokens expire after a few hours so you may need to refresh this occasionally.
          </div>
        </Step>

        <Step num="2" title="Run the Inventory">
          Go to <strong>Inventory</strong> and click <strong>Refresh Inventory</strong>. The tool will:
          <ul className={styles.stepList}>
            <li>Fetch all 131 custom Apex files from your Salesforce org</li>
            <li>Analyse each one — what it does, which objects it touches, quality rating</li>
            <li>Flag files with governor limit risks or quality issues</li>
            <li>Identify which ones could be replaced with a Flow</li>
            <li>Write everything to your Google Sheet automatically</li>
          </ul>
          <div className={styles.stepTip}>
            💡 The first run analyses everything and takes a few minutes. After that, it only re-analyses files that changed — so subsequent runs are much faster.
          </div>
        </Step>

        <Step num="3" title="Read the results">
          After the run, you'll see a table with every Apex file. Here is what each column means:
          <div className={styles.columnGuide}>
            {[
              ['Quality Rating', 'Good / Needs Work / Poor — overall health of the code'],
              ['Gov. Risk', 'YES means the code will crash when too many records are processed at once'],
              ['Can Be Flow?', 'Yes = this could be replaced with a no-code Flow. Probably = worth investigating'],
              ['Domain', 'Which business area this code belongs to — Sales, Finance, Customer Success etc.'],
              ['Change Status', 'New = added since last run. Changed = modified since last run'],
            ].map(([col, desc]) => (
              <div key={col} className={styles.columnRow}>
                <span className={styles.columnName}>{col}</span>
                <span className={styles.columnDesc}>{desc}</span>
              </div>
            ))}
          </div>
        </Step>

        <Step num="4" title="Debug a specific file">
          Go to <strong>Debugger</strong>. Open the Apex file in Salesforce Developer Console (Setup → Developer Console → File → Open → Classes), copy the code, paste it in the Debugger, and describe what it should do. The tool will:
          <ul className={styles.stepList}>
            <li>Identify every bug and rate it Critical / High / Medium / Low</li>
            <li>Show the exact line to change with a before/after code comparison</li>
            <li>Suggest optimisations for performance and maintainability</li>
            <li>Tell you if the whole thing could be replaced with a Flow</li>
            <li>Tell you exactly what to test after making the fixes</li>
          </ul>
          <div className={styles.stepTip}>
            💡 Click <strong>Load example</strong> in the Debugger to see a worked example using the InvoiceOnClosedWonOpp trigger from the Quizizz org.
          </div>
        </Step>
      </Section>

      {/* Reading quality ratings */}
      <Section icon="📊" title="How to Read the Quality Ratings">
        <p className={styles.sectionIntro}>Every file gets a rating. Here is exactly what each one means and what to do about it.</p>
        <div className={styles.ratingGrid}>
          <div className={styles.ratingCard} style={{borderColor:'#1B5E20'}}>
            <div className={styles.ratingBadge} style={{background:'#D4EFDF',color:'#1B5E20'}}>✅ Good</div>
            <p className={styles.ratingDesc}>The code follows best practices. No governor limit risks. Clean structure. You can leave this alone.</p>
            <p className={styles.ratingAction}><strong>Action:</strong> No immediate action needed. Document what it does and move on.</p>
          </div>
          <div className={styles.ratingCard} style={{borderColor:'#7D4E00'}}>
            <div className={styles.ratingBadge} style={{background:'#FEF3CD',color:'#7D4E00'}}>⚠️ Needs Work</div>
            <p className={styles.ratingDesc}>Has issues like debug statements left in, or logic that could be cleaner. Not broken but not great.</p>
            <p className={styles.ratingAction}><strong>Action:</strong> Put on a cleanup list. Use the Debugger to get exact fix suggestions.</p>
          </div>
          <div className={styles.ratingCard} style={{borderColor:'#8B0000'}}>
            <div className={styles.ratingBadge} style={{background:'#FDECEA',color:'#8B0000'}}>❌ Poor</div>
            <p className={styles.ratingDesc}>Has critical issues — usually SOQL or DML inside loops. Will cause errors when processing large volumes of records.</p>
            <p className={styles.ratingAction}><strong>Action:</strong> Fix urgently. Share with your developer or consultant using the Debugger output.</p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section icon="❓" title="Common Questions">
        <div className={styles.faqList}>
          <FaqItem
            q="I have zero coding knowledge. Can I still use this tool?"
            a="Yes — that is exactly who this tool is built for. You do not need to understand the code to use the Inventory. The tool reads the code for you and explains everything in plain English. The Debugger is more useful if you have a developer or consultant to hand the output to — you describe the problem, the tool diagnoses it, your developer fixes it."
          />
          <FaqItem
            q="Will this tool make any changes to my Salesforce org?"
            a="No. This tool only reads from Salesforce — it never writes, updates, or deletes anything in your org. The only thing it writes to is your Google Sheet. Your Salesforce data and code are completely safe."
          />
          <FaqItem
            q="My session token stopped working — what do I do?"
            a="Salesforce session tokens expire after a few hours. Go to workbench.developerforce.com, log in, click Info → Session Information, copy the new SessionId, and update it in Settings. This is normal and expected — you will need to do this each time you use the tool."
          />
          <FaqItem
            q="What is an Anthropic API key and why do I need it?"
            a="Anthropic makes Claude, the AI that powers the analysis in this tool. Without an API key, the tool falls back to basic local analysis which is less detailed. To get a key: go to console.anthropic.com, sign up, and create an API key under API Keys. There is a small cost per use (fractions of a cent per file analysed)."
          />
          <FaqItem
            q="The tool says a file 'Can Be Flow — Yes'. What does that mean?"
            a="It means the logic in that Apex file is simple enough that it could be rebuilt as a Salesforce Flow — a visual, no-code automation. Flows are easier to read, edit, and maintain without a developer. The Debugger tab will give you a detailed recommendation on whether to make the switch and what to watch out for."
          />
          <FaqItem
            q="What is a governor limit risk and why does it matter?"
            a="Salesforce puts strict limits on how much any piece of code can do at once — for example, maximum 100 database queries per transaction. If code has a query inside a loop, it can exceed this limit and crash when processing many records. The tool flags these as 'Governor Risk: YES'. These are the highest priority issues to fix."
          />
          <FaqItem
            q="Can I share this tool with my Salesforce consultant?"
            a="Yes — just send them this URL. They will need their own Salesforce token and Anthropic API key. Each person's credentials stay in their own browser and are never shared."
          />
        </div>
      </Section>

      {/* Glossary */}
      <Section icon="📖" title="Quick Glossary">
        <div className={styles.glossaryGrid}>
          {[
            ['Apex', 'Salesforce\'s programming language. Runs on Salesforce servers, not your computer.'],
            ['Trigger', 'Apex code that fires automatically when a record is created, updated, or deleted.'],
            ['Class', 'A file of reusable Apex code. Triggers usually call a Class to do the actual work.'],
            ['Test Class', 'Code that tests other code. Required by Salesforce before you can deploy changes.'],
            ['SOQL', 'Salesforce\'s database query language. Like asking "show me all Opportunities where Stage = Closed Won".'],
            ['DML', 'Database Manipulation Language — the Apex commands to insert, update, or delete records.'],
            ['Governor Limits', 'Salesforce\'s hard limits on what code can do. Hitting them causes errors.'],
            ['Bulkification', 'Writing code that handles 1 or 1,000 records the same way. Best practice in Apex.'],
            ['Flow', 'A no-code visual automation tool in Salesforce. Easier to maintain than Apex.'],
            ['Tooling API', 'A Salesforce API that allows tools to read Apex code programmatically.'],
            ['Queueable', 'A way to run Apex code asynchronously (in the background). Better than @future.'],
            ['Namespace', 'A prefix on managed package code (e.g. SBQQ__ for CPQ). This tool ignores namespaced code — it is not yours.'],
          ].map(([term, def]) => (
            <div key={term} className={styles.glossaryItem}>
              <div className={styles.glossaryTerm}>{term}</div>
              <div className={styles.glossaryDef}>{def}</div>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
