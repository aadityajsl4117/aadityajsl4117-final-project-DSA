import { LibraryProvider } from './store/LibraryStore';
import { ToastProvider } from './components/common/Toast';
import AppShell from './components/Layout/AppShell';

function App() {
  return (
    <LibraryProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </LibraryProvider>
  );
}

export default App;
