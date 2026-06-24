import React, { useState } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import InventoryPage from './pages/InventoryPage';
import DebuggerPage from './pages/DebuggerPage';
import SettingsPage from './pages/SettingsPage';
import HomePage from './pages/HomePage';
import styles from './App.module.css';

function Nav() {
  const links = [
    { to: '/',          label: 'Home',       icon: '🏠' },
    { to: '/inventory', label: 'Inventory',  icon: '📋' },
    { to: '/debugger',  label: 'Debugger',   icon: '🔍' },
    { to: '/settings',  label: 'Settings',   icon: '⚙️' },
  ];
  return (
    <nav className={styles.nav}>
      <div className={styles.navBrand}>
        <span className={styles.navLogo}>⚡</span>
        <div>
          <div className={styles.navTitle}>SFDC Apex Tool</div>
          <div className={styles.navSub}>Quizizz RevOps</div>
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
          <Route path="/debugger"  element={<DebuggerPage />} />
          <Route path="/settings"  element={<SettingsPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
