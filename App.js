import React from 'react';
import RootNavigation from './src/RootNavigation';
import { ToastProvider } from './src/ToastProvider';
const App = () => {
  return (
    <>
      <ToastProvider>
        <RootNavigation />
      </ToastProvider>
    </>
  );
};

export default App;
