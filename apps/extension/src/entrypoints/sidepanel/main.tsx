import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanel } from './SidePanel';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import '../../styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SidePanel />
    </ErrorBoundary>
  </React.StrictMode>
);
