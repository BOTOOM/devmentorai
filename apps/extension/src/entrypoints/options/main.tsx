import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { OptionsPage } from './OptionsPage';
import '../../styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OptionsPage />
    </ErrorBoundary>
  </React.StrictMode>
);
