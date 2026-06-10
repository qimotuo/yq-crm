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
import Profile from './pages/Profile'
import OperationLogList from './pages/OperationLogList'
import NotificationManage from './pages/NotificationManage'
import './api/rbac'
import './api/index'
import './api/notify'
import './api/workOrder'

function Guard({ path, children }) {
  return <RequireMenu path={path}>{children}</RequireMenu>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Guard path="/dashboard"><Dashboard /></Guard>} />
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
          <Route path="contracts" element={<Guard path="/contracts"><ContractList /></Guard>} />
          <Route path="integrated" element={<Guard path="/integrated"><IntegratedQuery /></Guard>} />
          <Route path="stock" element={<Guard path="/stock"><StockList /></Guard>} />
          <Route path="report-trace" element={<Guard path="/report-trace"><ReportTrace /></Guard>} />
          <Route path="system/users" element={<Guard path="/system/users"><SystemUserList /></Guard>} />
          <Route path="system/roles" element={<Guard path="/system/roles"><RoleList /></Guard>} />
          <Route path="system/notifications" element={<Guard path="/system/notifications"><NotificationManage /></Guard>} />
          <Route path="system/logs" element={<Guard path="/system/logs"><OperationLogList /></Guard>} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
