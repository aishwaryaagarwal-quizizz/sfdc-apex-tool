import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import InventoryPage from './pages/InventoryPage';
import DebuggerPage from './pages/DebuggerPage';
import SettingsPage from './pages/SettingsPage';
import styles from './App.module.css';

function Nav() {
  const links = [
    { to: '/',          label: 'Inventory',  icon: '📋' },
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
        <a href="https://github.com" target="_blank" rel="noreferrer" className={styles.githubLink}>
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
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"         element={<InventoryPage />} />
          <Route path="/debugger" element={<DebuggerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
