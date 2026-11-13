import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import { RequireMenu } from './components/RequireAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WorkOrderList from './pages/WorkOrderList'
import DispatchList from './pages/DispatchList'
import CustomerList from './pages/CustomerList'
import FinanceList from './pages/FinanceList'
import StockList from './pages/StockList'
import PublicPoolList from './pages/PublicPoolList'
import MyCustomerList from './pages/MyCustomerList'
import InstallRegister from './pages/InstallRegister'
import WorkOrderQuery from './pages/WorkOrderQuery'
import IntegratedQuery from './pages/IntegratedQuery'
import ReportTrace from './pages/ReportTrace'
import SystemUserList from './pages/SystemUserList'
import ScheduleList from './pages/ScheduleList'
import ContactList from './pages/ContactList'
import RoleList from './pages/RoleList'
import ContractList from './pages/ContractList'
import PoolConfig from './pages/PoolConfig'
import FollowUpList from './pages/FollowUpList'
import AccountLedger from './pages/AccountLedger'
import AdminLedger from './pages/AdminLedger'
import Profile from './pages/Profile'
import AgentHub from './pages/AgentHub'
import OperationLogList from './pages/OperationLogList'
import NotificationManage from './pages/NotificationManage'
import CtiConfig from './pages/CtiConfig'
import PrintTemplateConfig from './pages/PrintTemplateConfig'
import CallLogList from './pages/CallLogList'
import MobileLayout from './layouts/MobileLayout'
import MobileHome from './pages/mobile/MobileHome'
import MobileOrders from './pages/mobile/MobileOrders'
import MobileCustomers from './pages/mobile/MobileCustomers'
import MobileOrderDispatchDetail from './pages/mobile/MobileOrderDispatchDetail'
import MobileOrderDetail from './pages/mobile/MobileOrderDetail'
import MobileCustomerDetail from './pages/mobile/MobileCustomerDetail'
import MobileSchedules from './pages/mobile/MobileSchedules'
import MobileNotifications from './pages/mobile/MobileNotifications'
import MobileTrace from './pages/mobile/MobileTrace'
import MobileFollowUps from './pages/mobile/MobileFollowUps'
import MobileStockOut from './pages/mobile/MobileStockOut'
import MobileFinance from './pages/mobile/MobileFinance'
import MobileContracts from './pages/mobile/MobileContracts'
import MobileProfile from './pages/mobile/MobileProfile'
import MobileGuard from './components/MobileGuard'
import { getAppBasename } from './utils/basePath'
import './api/auth'
import './api/rbac'
import './api/index'
import './api/agent'
import './api/notify'
import './api/workOrder'
import './api/cti'

function Guard({ path, children }) {
  return <RequireMenu path={path}>{children}</RequireMenu>
}

function H5Routes() {
  const basename = getAppBasename()
  const h5Prefix = basename === '/h5' ? '' : '/h5'
  const h5Login = h5Prefix ? `${h5Prefix}/login` : '/login'
  const h5Root = h5Prefix || '/'

  return (
    <>
      <Route path={h5Login} element={<Login mobile />} />
      <Route path={h5Root} element={<MobileLayout />}>
        <Route index element={<MobileHome />} />
        <Route path="orders" element={<MobileGuard menuKeys={['/install-register', '/work-orders', '/dispatch']}><MobileOrders /></MobileGuard>} />
        <Route path="orders/dispatch" element={<MobileGuard menuKeys={['/install-register', '/work-orders', '/dispatch']}><MobileOrderDispatchDetail /></MobileGuard>} />
        <Route path="orders/detail" element={<MobileGuard menuKeys={['/install-register', '/work-orders']}><MobileOrderDetail /></MobileGuard>} />
        <Route path="customers" element={<MobileGuard menuKeys={['/my-customers', '/public-pool']}><MobileCustomers /></MobileGuard>} />
        <Route path="customers/detail" element={<MobileGuard menuKeys={['/my-customers', '/public-pool']}><MobileCustomerDetail /></MobileGuard>} />
        <Route path="follow-ups" element={<MobileGuard menuKeys="/follow-ups"><MobileFollowUps /></MobileGuard>} />
        <Route path="schedules" element={<MobileGuard menuKeys="/schedules"><MobileSchedules /></MobileGuard>} />
        <Route path="notifications" element={<MobileNotifications />} />
        <Route path="trace" element={<MobileTrace />} />
        <Route path="stock/out" element={<MobileGuard menuKeys="/stock"><MobileStockOut /></MobileGuard>} />
        <Route path="finance" element={<MobileGuard menuKeys="/finance"><MobileFinance /></MobileGuard>} />
        <Route path="contracts" element={<MobileGuard menuKeys="/contracts"><MobileContracts /></MobileGuard>} />
        <Route path="profile" element={<MobileProfile />} />
      </Route>
    </>
  )
}

function PcRoutes() {
  return (
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Guard path="/dashboard"><Dashboard /></Guard>} />
        <Route path="ai-agent" element={<Guard path="/ai-agent"><AgentHub /></Guard>} />
        <Route path="work-orders" element={<Guard path="/work-orders"><WorkOrderList /></Guard>} />
        <Route path="dispatch" element={<Guard path="/dispatch"><DispatchList /></Guard>} />
        <Route path="install-register" element={<Guard path="/install-register"><InstallRegister /></Guard>} />
        <Route path="work-order-query" element={<Guard path="/work-order-query"><WorkOrderQuery /></Guard>} />
        <Route path="public-pool" element={<Guard path="/public-pool"><PublicPoolList /></Guard>} />
        <Route path="pool-config" element={<Guard path="/pool-config"><PoolConfig /></Guard>} />
        <Route path="my-customers" element={<Guard path="/my-customers"><MyCustomerList /></Guard>} />
        <Route path="contacts" element={<Guard path="/contacts"><ContactList /></Guard>} />
        <Route path="follow-ups" element={<Guard path="/follow-ups"><FollowUpList /></Guard>} />
        <Route path="schedules" element={<Guard path="/schedules"><ScheduleList /></Guard>} />
        <Route path="customers" element={<Guard path="/customers"><CustomerList /></Guard>} />
        <Route path="finance" element={<Guard path="/finance"><FinanceList /></Guard>} />
        <Route path="account-ledger" element={<Guard path="/account-ledger"><AccountLedger /></Guard>} />
        <Route path="admin-ledger" element={<Guard path="/admin-ledger"><AdminLedger /></Guard>} />
        <Route path="contracts" element={<Guard path="/contracts"><ContractList /></Guard>} />
        <Route path="integrated" element={<Guard path="/integrated"><IntegratedQuery /></Guard>} />
        <Route path="stock" element={<Guard path="/stock"><StockList /></Guard>} />
        <Route path="report-trace" element={<Guard path="/report-trace"><ReportTrace /></Guard>} />
        <Route path="system/users" element={<Guard path="/system/users"><SystemUserList /></Guard>} />
        <Route path="system/roles" element={<Guard path="/system/roles"><RoleList /></Guard>} />
        <Route path="system/notifications" element={<Guard path="/system/notifications"><NotificationManage /></Guard>} />
        <Route path="system/call-logs" element={<Guard path="/system/call-logs"><CallLogList /></Guard>} />
        <Route path="system/cti-config" element={<Guard path="/system/cti-config"><CtiConfig /></Guard>} />
        <Route path="system/print-template" element={<Guard path="/system/print-template"><PrintTemplateConfig /></Guard>} />
        <Route path="system/logs" element={<Guard path="/system/logs"><OperationLogList /></Guard>} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </>
  )
}

function App() {
  const basename = getAppBasename()
  const showH5 = basename === '/h5' || basename === ''
  const showPc = basename === '/crm' || basename === ''

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        {showH5 && H5Routes()}
        {showPc && PcRoutes()}
      </Routes>
    </BrowserRouter>
  )
}

export default App
