import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { OptionsPage } from './OptionsPage';
import '../../styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OptionsPage />
    </ErrorBoundary>
  </React.StrictMode>
);
