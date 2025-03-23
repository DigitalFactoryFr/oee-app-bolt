import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useProjectStore } from './store/projectStore';


// Pages
import Header from './components/Header';
import Hero from './components/Hero';
import PricingSection from './components/PricingSection';
import Footer from './components/Footer';
import AuthPage from './components/AuthPage';
import AuthCallback from './components/AuthCallback';
import Dashboard from './pages/Dashboard';
import NewProject from './pages/NewProject';
import About from './pages/About';
import Contact from './pages/Contact';
import Factory from './pages/project/Factory';
import ProductionLine from './pages/project/ProductionLine';
import Products from './pages/project/Products';
import Teams from './pages/project/Teams';
import DataConnection from './pages/project/DataConnection';
import PlantConfig from './pages/project/PlantConfig';
import ProductionLines from './pages/project/ProductionLines';
import Machines from './pages/project/Machines';
import ProtectedRoute from './components/ProtectedRoute';
import NewLot from './pages/project/lots/NewLot';
import LotsPage from './pages/project/lots';
import LotTracking from './pages/project/lots/LotTracking';
import NewStopEvent from './pages/project/stops/NewStopEvent';
import EditStopEvent from './pages/project/stops/EditStopEvent';
import SelectLot from './pages/project/stops/SelectLot';
import StopsPage from './pages/project/stops';
import NewQualityIssue from './pages/project/quality/NewQualityIssue';
import EditQualityIssue from './pages/project/quality/EditQualityIssue';
import SelectLotQuality from './pages/project/quality/SelectLot';
import QualityIssuesPage from './pages/project/quality';
import ReportsPage from './pages/project/reports';
import RealTimeMonitoring from './pages/project/reports/RealTimeMonitoring';
import QualityCausesTracking from './pages/project/reports/QualityCausesTracking';
import StopsCausesTracking from './pages/project/reports/StopsCausesTracking';
import QualityPareto from './pages/project/reports/QualityPareto';
import StopsPareto from './pages/project/reports/StopsPareto';
import OEEReport from './pages/project/reports/OEEReport';
import OEEDraft from './pages/project/reports/OEEDraft';
import ProductionReport from './pages/project/reports/ProductionReport';
import QualityReport from './pages/project/reports/QualityReport';
import DowntimeReport from './pages/project/reports/DowntimeReport';
import PredictiveMaintenance from './pages/project/reports/PredictiveMaintenance';
import AIAgents from './pages/project/AIAgents';
import InvitePage from './pages/InvitePage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import CheckoutCancelPage from './pages/CheckoutCancelPage';








function App() {
  const { getUser } = useAuthStore();

  React.useEffect(() => {
    getUser();
  }, [getUser]);

useEffect(() => {
  useProjectStore.getState().loadCurrentProject();
}, []);

  
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={
          <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <Header />
            <Hero />
            <PricingSection />
            <Footer />
          </div>
        } />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/invite/:inviteId" element={<InvitePage />} />
        <Route path="/success" element={<CheckoutSuccessPage />} />
        <Route path="/cancel" element={<CheckoutCancelPage />} />
        
        {/* Protected routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        {/* Project routes */}
        <Route path="/projects/new" element={
          <ProtectedRoute>
            <NewProject />
          </ProtectedRoute>
        } />
        
        {/* Onboarding routes */}
        <Route path="/projects/:projectId/onboarding/plant" element={
          <ProtectedRoute>
            <PlantConfig />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/onboarding/lines" element={
          <ProtectedRoute>
            <ProductionLines />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/onboarding/machines" element={
          <ProtectedRoute>
            <Machines />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/onboarding/products" element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/onboarding/teams" element={
          <ProtectedRoute>
            <Teams />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/onboarding/data" element={
          <ProtectedRoute>
            <DataConnection />
          </ProtectedRoute>
        } />
        
        {/* Production Lots routes */}
        <Route path="/projects/:projectId/lots" element={
          <ProtectedRoute>
            <LotsPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/lots/new" element={
          <ProtectedRoute>
            <NewLot />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/lots/:lotId" element={
          <ProtectedRoute>
            <LotTracking />
          </ProtectedRoute>
        } />
        
        {/* Stop Events routes */}
        <Route path="/projects/:projectId/stops" element={
          <ProtectedRoute>
            <StopsPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/stops/select-lot" element={
          <ProtectedRoute>
            <SelectLot />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/stops/new" element={
          <ProtectedRoute>
            <NewStopEvent />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/stops/:stopId" element={
          <ProtectedRoute>
            <EditStopEvent />
          </ProtectedRoute>
        } />

        {/* Quality Issues routes */}
        <Route path="/projects/:projectId/quality" element={
          <ProtectedRoute>
            <QualityIssuesPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/quality/select-lot" element={
          <ProtectedRoute>
            <SelectLotQuality />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/quality/new" element={
          <ProtectedRoute>
            <NewQualityIssue />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/quality/:issueId" element={
          <ProtectedRoute>
            <EditQualityIssue />
          </ProtectedRoute>
        } />

        {/* Report routes */}
        <Route path="/projects/:projectId/reports" element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/reports/oee" element={
          <ProtectedRoute>
            <OEEReport />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/reports/oee-draft" element={
          <ProtectedRoute>
            <OEEDraft />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/reports/production" element={
          <ProtectedRoute>
            <ProductionReport />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/reports/quality" element={
          <ProtectedRoute>
            <QualityReport />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/reports/downtime" element={
          <ProtectedRoute>
            <DowntimeReport />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/reports/realtime" element={
          <ProtectedRoute>
            <RealTimeMonitoring />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/reports/predictive" element={
          <ProtectedRoute>
            <PredictiveMaintenance />
          </ProtectedRoute>
        } />
             <Route path="/projects/:projectId/reports/qualitytracking" element={
          <ProtectedRoute>
            <QualityCausesTracking />
          </ProtectedRoute>
        } />
             <Route path="/projects/:projectId/reports/stopstracking" element={
          <ProtectedRoute>
            <StopsCausesTracking />
          </ProtectedRoute>
        } />
         <Route path="/projects/:projectId/reports/qualitypareto" element={
          <ProtectedRoute>
            <QualityPareto />
          </ProtectedRoute>
        } />
         <Route path="/projects/:projectId/reports/stopspareto" element={
          <ProtectedRoute>
            <StopsPareto />
          </ProtectedRoute>
        } />

        {/* AI Agents route */}
        <Route path="/projects/:projectId/ai-agents" element={
          <ProtectedRoute>
            <AIAgents />
          </ProtectedRoute>
        } />

        {/* Other project routes */}
        <Route path="/projects/:projectId" element={
          <ProtectedRoute>
            <Factory />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/factory" element={
          <ProtectedRoute>
            <Factory />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/production-line" element={
          <ProtectedRoute>
            <ProductionLine />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/products" element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/teams" element={
          <ProtectedRoute>
            <Teams />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/data-connection" element={
          <ProtectedRoute>
            <DataConnection />
          </ProtectedRoute>
        } />
        
        {/* Redirect to dashboard if logged in, otherwise to home */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />



    {/* Autres routes */}

    {/* Route pour /projects/:projectId/dashboard */}
    <Route path="/projects/:projectId/dashboard" element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    } />

    {/* Route existante pour /dashboard (global) */}
    <Route path="/dashboard" element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    } />



        
      </Routes>
    </Router>
  );
}

export default App;