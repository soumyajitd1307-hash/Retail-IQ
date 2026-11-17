import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Segmentation from './pages/Segmentation';
import CustomerExplorer from './pages/CustomerExplorer';
import RfmAnalysis from './pages/RfmAnalysis';
import RevenueBehaviour from './pages/RevenueBehaviour';
import IntroAnimation from './components/common/IntroAnimation';

export default function App() {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const handleReplay = () => setShowIntro(true);
    window.addEventListener('retailiq-replay-intro', handleReplay);
    return () => window.removeEventListener('retailiq-replay-intro', handleReplay);
  }, []);

  return (
    <>
      {showIntro && (
        <IntroAnimation onComplete={() => setShowIntro(false)} />
      )}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="segmentation" element={<Segmentation />} />
            <Route path="explorer" element={<CustomerExplorer />} />
            <Route path="rfm" element={<RfmAnalysis />} />
            <Route path="revenue" element={<RevenueBehaviour />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
