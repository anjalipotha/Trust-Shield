import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { getCurrentUser, signOutUser, getSupabaseConfig } from './lib/supabase';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { MessageAnalyzerPage } from './pages/MessageAnalyzerPage';
import { UrlCheckerPage } from './pages/UrlCheckerPage';
import { ProductCheckerPage } from './pages/ProductCheckerPage';
import { InvestigationsPage } from './pages/InvestigationsPage';
import { EvidenceManagerPage } from './pages/EvidenceManagerPage';
import { ReportsPage } from './pages/ReportsPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  // Cross-page navigation context (e.g. passing an extracted URL or case ID)
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [targetCaseId, setTargetCaseId] = useState<string | null>(null);

  const checkConnectionStatus = () => {
    const cfg = getSupabaseConfig();
    setIsSupabaseConnected(cfg.isConfigured);
  };

  useEffect(() => {
    checkConnectionStatus();
    getCurrentUser()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
          setCurrentTab('dashboard');
        } else {
          setCurrentTab('landing');
        }
      })
      .catch((err) => {
        console.warn('Session init error:', err);
      })
      .finally(() => {
        setLoadingSession(false);
      });
  }, []);

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setCurrentTab('dashboard');
  };

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
    setCurrentTab('landing');
  };

  const handleNavigate = (tab: string, context?: any) => {
    if (context?.url) {
      setTargetUrl(context.url);
    }
    if (context?.caseId) {
      setTargetCaseId(context.caseId);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#080c16] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-xs font-mono tracking-wider uppercase text-slate-400">
            Initializing TrustShield Forensics...
          </div>
        </div>
      </div>
    );
  }

  // 1. Landing Page View (unauthenticated or explicitly requested)
  if (currentTab === 'landing') {
    return (
      <LandingPage
        onEnterApp={() => {
          if (currentUser) setCurrentTab('dashboard');
          else setCurrentTab('auth');
        }}
        onOpenScan={(scanType) => {
          if (currentUser) {
            setCurrentTab(scanType);
          } else {
            setCurrentTab('auth');
          }
        }}
      />
    );
  }

  // 2. Authentication View
  if (currentTab === 'auth') {
    return (
      <AuthPage
        onAuthSuccess={handleAuthSuccess}
        onCancel={() => setCurrentTab('landing')}
      />
    );
  }

  // 3. Authenticated App Layout (Dashboard, Analyzers, Cases, Evidence, Reports, History, Settings)
  // If user is somehow null in console views, fallback to guest/auth prompt
  const effectiveUser: UserProfile = currentUser || {
    id: 'local_analyst',
    email: 'analyst@trustshield.internal',
    display_name: 'Security Investigator',
    organization: 'Threat Operations',
    created_at: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-[#080c16] text-slate-100 flex flex-col md:flex-row selection:bg-sky-500/30 selection:text-sky-200">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => handleNavigate(tab)}
        isSupabaseConnected={isSupabaseConnected}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          currentTab={currentTab}
          user={currentUser}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenLanding={() => setCurrentTab('landing')}
          onSelectTab={(tab) => handleNavigate(tab)}
          isSupabaseConnected={isSupabaseConnected}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {currentTab === 'dashboard' && (
            <DashboardPage
              user={effectiveUser}
              onNavigate={handleNavigate}
              isSupabaseConnected={isSupabaseConnected}
            />
          )}

          {currentTab === 'messages' && (
            <MessageAnalyzerPage
              user={effectiveUser}
              onNavigateToUrlScan={(urlToScan) => {
                setTargetUrl(urlToScan);
                setCurrentTab('urls');
              }}
              onNavigateToCases={() => setCurrentTab('cases')}
            />
          )}

          {currentTab === 'urls' && (
            <UrlCheckerPage
              user={effectiveUser}
              initialUrl={targetUrl}
              onNavigateToCases={() => setCurrentTab('cases')}
            />
          )}

          {currentTab === 'products' && (
            <ProductCheckerPage user={effectiveUser} />
          )}

          {currentTab === 'cases' && (
            <InvestigationsPage
              user={effectiveUser}
              selectedCaseId={targetCaseId}
              onNavigateToReports={(caseId) => {
                setTargetCaseId(caseId);
                setCurrentTab('reports');
              }}
              onNavigateToEvidence={(caseId) => {
                setTargetCaseId(caseId || null);
                setCurrentTab('evidence');
              }}
            />
          )}

          {currentTab === 'evidence' && (
            <EvidenceManagerPage
              user={effectiveUser}
              preselectedCaseId={targetCaseId}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsPage
              user={effectiveUser}
              initialCaseId={targetCaseId}
            />
          )}

          {currentTab === 'history' && (
            <ScanHistoryPage user={effectiveUser} />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              user={effectiveUser}
              isSupabaseConnected={isSupabaseConnected}
              onRefreshConfig={checkConnectionStatus}
            />
          )}
        </main>
      </div>
    </div>
  );
}
