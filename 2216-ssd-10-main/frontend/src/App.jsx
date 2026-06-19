import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import Admin from './pages/Admin'
import AddFunds from './pages/AddFunds'
import Dashboard from './pages/Dashboard'
import Exchange from './pages/Exchange'
import History from './pages/History'
import Register from './pages/Register'
import SendMoney from './pages/SendMoney'
import SignIn from './pages/SignIn'
import TransferSuccess from './pages/TransferSuccess'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell title="Dashboard" subtitle="Secure SITWallet workspace" searchPlaceholder="Search transactions..." />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/send-money" element={<SendMoney />} />
          <Route path="/exchange" element={<Exchange />} />
          <Route path="/history" element={<History />} />
          <Route path="/add-funds" element={<AddFunds />} />
          <Route path="/transfer-success" element={<TransferSuccess />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={['admin', 'support']} />}>
        <Route element={<AppShell title="Admin Portal" subtitle="Platform oversight and controls" searchPlaceholder="Search users..." />}>
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
