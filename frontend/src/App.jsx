// import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
// import { AuthProvider, useAuth, dashboardPath } from "./context/AuthContext";
// import ProtectedRoute from "./components/ProtectedRoute";
// import Layout from "./components/Layout";
// import Login from "./pages/Login";
// import Register from "./pages/Register";
// import GoogleSuccess from "./pages/googleSucces";
// import ForgotPassword from "./pages/ForgotPassword";
// import ResetPassword from "./pages/ResetPassword";
// import UserDashboard from "./pages/UserDashboard";
// import ReportIssue from "./pages/ReportIssue";
// import MyTickets from "./pages/MyTickets";
// import TicketDetails from "./pages/TicketDetails";
// import WorkerDashboard from "./pages/workerDashboard";
// import ExploreTickets from "./pages/ExploreTickets";
// import MyJobs from "./pages/MyJobs";
// import AdminDashboard from "./pages/AdminDashboard";
// import AdminTickets from "./pages/AdminTickets";
// import { AdminReports, AdminUsers, AdminWorkers } from "./pages/AdminPeople";
// import Notifications from "./pages/Notifications";
// import Profile from "./pages/Profile";
// import AdminRoutes from "./routes/AdminRoutes";

// function HomeRedirect() {
//   const { user, loading } = useAuth();
//   if (loading) return <div className="page-loading">Loading FixFlow…</div>;
//   if (user) return <Navigate to={dashboardPath(user.role)} replace />;
//   return <Login />;
// }

// function App() {
//   return (
//     <AuthProvider>
//       <BrowserRouter>
//         <Routes>
//           <Route path="/" element={<HomeRedirect />} />
//           <Route path="/login" element={<HomeRedirect />} />
//           <Route path="/register" element={<Register />} />
//           <Route path="/forgot-password" element={<ForgotPassword />} />
//           <Route
//     path="/reset-password/:token"
//     element={<ResetPassword />}
// />
//           <Route path="/google-success" element={<GoogleSuccess />} />

//           <Route
//             element={
//               <ProtectedRoute roles={["user", "worker", "admin"]}>
//                 <Layout />
//               </ProtectedRoute>
//             }
//           >
//             <Route
//               path="/user-dashboard"
//               element={
//                 <ProtectedRoute roles={["user"]}>
//                   <UserDashboard />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/report-issue"
//               element={
//                 <ProtectedRoute roles={["user"]}>
//                   <ReportIssue />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/my-tickets"
//               element={
//                 <ProtectedRoute roles={["user"]}>
//                   <MyTickets />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/worker-dashboard"
//               element={
//                 <ProtectedRoute roles={["worker"]}>
//                   <WorkerDashboard />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/explore-tickets"
//               element={
//                 <ProtectedRoute roles={["worker"]}>
//                   <ExploreTickets />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/my-jobs"
//               element={
//                 <ProtectedRoute roles={["worker"]}>
//                   <MyJobs />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/admin-dashboard"
//               element={
//                 <ProtectedRoute roles={["admin"]}>
//                   <AdminDashboard />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/admin/tickets"
//               element={
//                 <ProtectedRoute roles={["admin"]}>
//                   <AdminTickets />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/admin/users"
//               element={
//                 <ProtectedRoute roles={["admin"]}>
//                   <AdminUsers />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/admin/workers"
//               element={
//                 <ProtectedRoute roles={["admin"]}>
//                   <AdminWorkers />
//                 </ProtectedRoute>
//               }
//             />
//             <Route
//               path="/admin/reports"
//               element={
//                 <ProtectedRoute roles={["admin"]}>
//                   <AdminReports />
//                 </ProtectedRoute>
//               }
//             />
//             <Route path="/tickets/:id" element={<TicketDetails />} />
//             <Route path="/notifications" element={<Notifications />} />
//             <Route path="/profile" element={<Profile />} />
//           </Route>
//         </Routes>
//       </BrowserRouter>
//     </AuthProvider>
//   );
// }

// export default App;

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth, dashboardPath } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

// Authentication pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import GoogleSuccess from "./pages/googleSucces";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// User pages
import UserDashboard from "./pages/UserDashboard";
import ReportIssue from "./pages/ReportIssue";
import MyTickets from "./pages/MyTickets";
import Settings from "./pages/Settings";

// Worker pages
import WorkerDashboard from "./pages/workerDashboard";
import ExploreTickets from "./pages/ExploreTickets";
import MyJobs from "./pages/MyJobs";

// Shared pages
import TicketDetails from "./pages/TicketDetails";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";

// Admin routes
import AdminRoutes from "./components/AdminRoutes";

// Redirect logged-in users to their respective dashboards
function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading FixFlow…</div>;
  }

  if (user) {
    return <Navigate to={dashboardPath(user.role)} replace />;
  }

  return <Login />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Authentication */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<HomeRedirect />} />

          <Route path="/register" element={<Register />} />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          <Route
            path="/reset-password/:token"
            element={<ResetPassword />}
          />

          <Route
            path="/google-success"
            element={<GoogleSuccess />}
          />

          {/* Admin panel — separate admin layout */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminRoutes />
              </ProtectedRoute>
            }
          />

          {/* User and Worker application layout */}
          <Route
            element={
              <ProtectedRoute roles={["user", "worker"]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* User routes */}
            <Route
              path="/user-dashboard"
              element={
                <ProtectedRoute roles={["user"]}>
                  <UserDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/report-issue"
              element={
                <ProtectedRoute roles={["user"]}>
                  <ReportIssue />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-tickets"
              element={
                <ProtectedRoute roles={["user"]}>
                  <MyTickets />
                </ProtectedRoute>
              }
            />

            {/* Worker routes */}
            <Route
              path="/worker-dashboard"
              element={
                <ProtectedRoute roles={["worker"]}>
                  <WorkerDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/explore-tickets"
              element={
                <ProtectedRoute roles={["worker"]}>
                  <ExploreTickets />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-jobs"
              element={
                <ProtectedRoute roles={["worker"]}>
                  <MyJobs />
                </ProtectedRoute>
              }
            />

            {/* Shared routes */}
            <Route
              path="/tickets/:id"
              element={<TicketDetails />}
            />

            <Route
              path="/notifications"
              element={<Notifications />}
            />

            <Route
              path="/profile"
              element={<Profile />}
            />

            {/* Settings — accessible to users and workers */}
            <Route
              path="/settings"
              element={<Settings />}
            />
          </Route>

          {/* Unknown URLs */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
