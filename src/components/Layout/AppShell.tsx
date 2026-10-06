import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Sidebar, ViewType } from './Sidebar';
import { Header } from './Header';
import { Dashboard } from '../Dashboard';
import { LoadingSpinner } from '../common';

// Lazy load page components with fallback resolution
const BookCatalog = lazy(() => import('../Books/BookCatalog').then((m: any) => ({ default: m.default || m.BookCatalog })));
const MemberDirectory = lazy(() => import('../Members/MemberDirectory').then((m: any) => ({ default: m.default || m.MemberDirectory })));
const Circulation = lazy(() => import('../Circulation/Circulation').then((m: any) => ({ default: m.default || m.Circulation })));
const Reservations = lazy(() => import('../Reservations/Reservations').then((m: any) => ({ default: m.default || m.Reservations })));
const Fines = lazy(() => import('../Fines/Fines').then((m: any) => ({ default: m.default || m.Fines })));
const EmailLogs = lazy(() => import('../Email/EmailLogs').then((m: any) => ({ default: m.default || m.EmailLogs })));
const Analytics = lazy(() => import('../Analytics/Analytics').then((m: any) => ({ default: m.default || m.Analytics })));
const AIAssistant = lazy(() => import('../AI/AIAssistant').then((m: any) => ({ default: m.default || m.AIAssistant })));
const AuditHistory = lazy(() => import('../Audit/AuditHistory').then((m: any) => ({ default: m.default || m.AuditHistory })));
const Restock = lazy(() => import('../Restock/Restock').then((m: any) => ({ default: m.default || m.Restock })));
const QRBarcode = lazy(() => import('../QR/QRBarcode').then((m: any) => ({ default: m.default || m.QRBarcode })));

const PageLoader = () => (
  <div className="flex items-center justify-center h-96">
    <LoadingSpinner size="lg" text="Loading Section..." />
  </div>
);

const AppShell: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeView]);

  const viewTitles: Record<ViewType, string> = {
    'dashboard': 'Dashboard',
    'books': 'Book Catalog',
    'members': 'Member Directory',
    'circulation': 'Borrow & Return',
    'reservations': 'Reservations & Waitlist',
    'fines': 'Fines & Payments',
    'email-logs': 'Email Delivery Logs',
    'analytics': 'Analytics & Reports',
    'ai-assistant': 'AI Library Assistant',
    'audit': 'Audit History',
    'restock': 'Restock Management',
    'qr-barcode': 'QR / Barcode',
  };

  const handleNavigate = (view: string) => {
    setActiveView(view as ViewType);
  };

  const renderContent = () => {
    return (
      <Suspense fallback={<PageLoader />}>
        {activeView === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
        {activeView === 'books' && <BookCatalog />}
        {activeView === 'members' && <MemberDirectory />}
        {activeView === 'circulation' && <Circulation />}
        {activeView === 'reservations' && <Reservations />}
        {activeView === 'fines' && <Fines />}
        {activeView === 'email-logs' && <EmailLogs />}
        {activeView === 'analytics' && <Analytics />}
        {activeView === 'ai-assistant' && <AIAssistant />}
        {activeView === 'audit' && <AuditHistory />}
        {activeView === 'restock' && <Restock />}
        {activeView === 'qr-barcode' && <QRBarcode />}
      </Suspense>
    );
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className={`
        fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      >
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          isCollapsed={isDesktopCollapsed}
          onToggle={() => setIsDesktopCollapsed(prev => !prev)}
        />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header
          title={viewTitles[activeView] || activeView}
          onMenuToggle={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="mx-auto max-w-7xl">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
