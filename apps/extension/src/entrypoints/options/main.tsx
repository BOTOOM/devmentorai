import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsPage } from './OptionsPage';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import '../../styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OptionsPage />
    </ErrorBoundary>
  </React.StrictMode>
);
