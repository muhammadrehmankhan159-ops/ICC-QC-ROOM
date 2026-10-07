import ReactDOM from 'react-dom/client';import {BrowserRouter,Routes,Route,Navigate,Outlet,useLocation} from 'react-router-dom';
import {AuthProvider,useAuth} from './lib';import {gate,isTemporaryAdminOverride} from './access';import {Dashboard} from './dashboard';import {DepartmentPage} from './department';import {ReportsList,NewInspection,ReportDetail} from './reports';import {PortalShell,PortalCurrent,PortalReports,PortalReport} from './portal';import {Login,Layout,Denied,Inactive,AdminHome,AdminSection} from './pages';import './style.css';
function Guard(){const {session,profile,loading}=useAuth();const loc=useLocation();
 const tempAdmin=isTemporaryAdminOverride(session?.user?.email ?? profile?.email);
 if(loading)return <p style={{padding:24}}>Checking session…</p>;if(!session)return <Navigate to="/login" replace/>;
 if(!profile||!profile.active){ if(tempAdmin) return <Outlet/>; return <Inactive/>; }
 const g=gate(loc.pathname,profile,session?.user?.email);if(g==='denied' && !tempAdmin)return <Denied/>;if(g==='portal' && !tempAdmin)return <Navigate to="/app/portal" replace/>;return <Outlet/>}
function Home(){const {session,profile}=useAuth();const tempAdmin=isTemporaryAdminOverride(session?.user?.email ?? profile?.email);return <Navigate to={tempAdmin?'/app/admin':profile?.role==='customer'?'/app/portal':'/app/dashboard'} replace/>}
ReactDOM.createRoot(document.getElementById('root')!).render(<AuthProvider><BrowserRouter><Routes>
 <Route path="/login" element={<Login/>}/>
 <Route path="/app" element={<Guard/>}><Route element={<Layout/>}>
  <Route index element={<Home/>}/><Route path="dashboard" element={<Dashboard/>}/><Route path="department/:code" element={<DepartmentPage/>}/><Route path="portal" element={<PortalShell/>}><Route index element={<PortalCurrent/>}/><Route path="reports" element={<PortalReports/>}/><Route path="report/:rid" element={<PortalReport/>}/></Route><Route path="reports" element={<ReportsList/>}/><Route path="reports/new" element={<NewInspection/>}/><Route path="reports/:rid" element={<ReportDetail/>}/>
  <Route path="admin" element={<AdminHome/>}/><Route path="admin/:section" element={<AdminSection/>}/></Route></Route>
 <Route path="*" element={<Navigate to="/app" replace/>}/></Routes></BrowserRouter></AuthProvider>);
