import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Pages
import Header from './components/Header';
import Hero from './components/Hero';
import PricingSection from './components/PricingSection';
import Footer from './components/Footer';
import AuthPage from './components/AuthPage';
import Dashboard from './pages/Dashboard';
import NewProject from './pages/NewProject';
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
import OEEReport from './pages/project/reports/OEEReport';
import OEEDraft from './pages/project/reports/OEEDraft';
import ProductionReport from './pages/project/reports/ProductionReport';
import QualityReport from './pages/project/reports/QualityReport';
import DowntimeReport from './pages/project/reports/DowntimeReport';
import PredictiveMaintenance from './pages/project/reports/PredictiveMaintenance';
import AIAgents from './pages/project/AIAgents';

// Icons for pricing plans
import { Activity, BarChart3, Cpu, Database, FileSpreadsheet, Gauge, Lock, Server, Settings, Users } from 'lucide-react';

function App() {
  const { getUser } = useAuthStore();

  React.useEffect(() => {
    getUser();
  }, [getUser]);

  const pricingPlans = [
    {
      name: "Free",
      subtitle: "Starter",
      price: "$0",
      period: "forever",
      description: "Ideal for small businesses starting with OEE tracking",
      features: [
        { text: "1 production line", icon: <Activity size={18} /> },
        { text: "30 entries per day", icon: <Database size={18} /> },
        { text: "1 user", icon: <Users size={18} /> },
        { text: "Basic OEE dashboard", icon: <BarChart3 size={18} /> },
        { text: "Excel import/export", icon: <FileSpreadsheet size={18} /> },
      ],
      cta: "Start for free",
      highlighted: false
    },
    {
      name: "Pro",
      subtitle: "SaaS – Monthly subscription",
      price: "$99",
      period: "per month",
      description: "For businesses looking to optimize their production",
      features: [
        { text: "Unlimited production lines", icon: <Activity size={18} /> },
        { text: "Unlimited entries", icon: <Database size={18} /> },
        { text: "Advanced user management", icon: <Users size={18} /> },
        { text: "Machine connectivity (MQTT, SQL, REST API)", icon: <Cpu size={18} /> },
        { text: "Advanced dashboard with detailed KPIs", icon: <BarChart3 size={18} /> },
        { text: "Export to Excel, Power BI, ERP API", icon: <FileSpreadsheet size={18} /> },
      ],
      cta: "14-day free trial",
      highlighted: true
    },
    {
      name: "Enterprise",
      subtitle: "On-Premise",
      price: "Custom",
      period: "contact us",
      description: "Complete solution for large industrial enterprises",
      features: [
        { text: "All Pro features", icon: <Settings size={18} /> },
        { text: "On-premise server installation", icon: <Server size={18} /> },
        { text: "Advanced configuration and full data access", icon: <Lock size={18} /> },
        { text: "Dedicated support & custom integration", icon: <Gauge size={18} /> },
      ],
      cta: "Contact us",
      highlighted: false
    }
  ];

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={
          <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <Header />
            <Hero />
            <PricingSection plans={pricingPlans} />
            <Footer />
          </div>
        } />
        <Route path="/auth" element={<AuthPage />} />
        
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
      </Routes>
    </Router>
  );
}

export default App;