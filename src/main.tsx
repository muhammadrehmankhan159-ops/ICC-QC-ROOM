import ReactDOM from 'react-dom/client';import {BrowserRouter,Routes,Route,Navigate,Outlet,useLocation} from 'react-router-dom';
import {SpeedInsights} from '@vercel/speed-insights/react';
import {AuthProvider,useAuth} from './lib';import {gate} from './access';import {Dashboard} from './dashboard';import {DepartmentPage} from './department';import {ReportsList,NewInspection,ReportDetail} from './reports';import {PortalShell,PortalCurrent,PortalReports,PortalReport} from './portal';import {Login,Layout,Denied,Inactive,AdminHome,AdminSection} from './pages';import './style.css';
function Guard(){const {session,profile,loading}=useAuth();const loc=useLocation();
 if(loading)return <p style={{padding:24}}>Checking session…</p>;if(!session)return <Navigate to="/login" replace/>;
 if(!profile||!profile.active)return <Inactive/>;
 const g=gate(loc.pathname,profile);if(g==='denied')return <Denied/>;if(g==='portal')return <Navigate to="/app/portal" replace/>;return <Outlet/>}
function Home(){const {profile}=useAuth();return <Navigate to={profile?.role==='customer'?'/app/portal':'/app/dashboard'} replace/>}
ReactDOM.createRoot(document.getElementById('root')!).render(<AuthProvider><BrowserRouter><SpeedInsights/><Routes>
 <Route path="/login" element={<Login/>}/>
 <Route path="/app" element={<Guard/>}><Route element={<Layout/>}>
  <Route index element={<Home/>}/><Route path="dashboard" element={<Dashboard/>}/><Route path="department/:code" element={<DepartmentPage/>}/><Route path="portal" element={<PortalShell/>}><Route index element={<PortalCurrent/>}/><Route path="reports" element={<PortalReports/>}/><Route path="report/:rid" element={<PortalReport/>}/></Route><Route path="reports" element={<ReportsList/>}/><Route path="reports/new" element={<NewInspection/>}/><Route path="reports/:rid" element={<ReportDetail/>}/>
  <Route path="admin" element={<AdminHome/>}/><Route path="admin/:section" element={<AdminSection/>}/></Route></Route>
 <Route path="*" element={<Navigate to="/app" replace/>}/></Routes></BrowserRouter></AuthProvider>);
