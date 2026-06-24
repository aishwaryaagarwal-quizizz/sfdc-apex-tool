import React from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import InventoryPage from './pages/InventoryPage';
import FlowsPage from './pages/FlowsPage';
import FieldsPage from './pages/FieldsPage';
import DebuggerPage from './pages/DebuggerPage';
import SettingsPage from './pages/SettingsPage';
import HomePage from './pages/HomePage';
import styles from './App.module.css';

function Nav() {
  const links = [
    { to: '/',          label: 'Dashboard',  icon: '🏠' },
    { to: '/inventory', label: 'Apex',       icon: '⚡' },
    { to: '/flows',     label: 'Flows',      icon: '🔀' },
    { to: '/fields',    label: 'Fields',     icon: '🏷️' },
    { to: '/debugger',  label: 'Debugger',   icon: '🔍' },
    { to: '/settings',  label: 'Settings',   icon: '⚙️' },
  ];
  return (
    <nav className={styles.nav}>
      <div className={styles.navBrand}>
        <span className={styles.navLogo}>⚡</span>
        <div>
          <div className={styles.navTitle}>SFDC RevOps Tool</div>
          <div className={styles.navSub}>Quizizz</div>
        </div>
      </div>
      <div className={styles.navLinks}>
        {links.map(l => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}>
            <span className={styles.navIcon}>{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </div>
      <div className={styles.navFooter}>
        <a href="https://github.com/aishwaryaagarwal-quizizz/sfdc-apex-tool" target="_blank" rel="noreferrer" className={styles.githubLink}>
          View on GitHub →
        </a>
      </div>
    </nav>
  );
}

function Layout({ children }) {
  return (
    <div className={styles.layout}>
      <Nav />
      <main className={styles.main}>
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/"          element={<HomePage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/flows"     element={<FlowsPage />} />
          <Route path="/fields"    element={<FieldsPage />} />
          <Route path="/debugger"  element={<DebuggerPage />} />
          <Route path="/settings"  element={<SettingsPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
