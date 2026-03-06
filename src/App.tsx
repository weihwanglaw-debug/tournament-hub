import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LiveConfigProvider } from "@/contexts/LiveConfigContext";

import Landing from "@/pages/Landing";
import EventDetail from "@/pages/EventDetail";
import PaymentResult from "@/pages/PaymentResult";
import Login from "@/pages/Login";
import AdminLayout from "@/components/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import AdminEvents from "@/pages/admin/Events";
import EventEdit from "@/pages/admin/EventEdit";
import AdminRegistrations from "@/pages/admin/Registrations";
import AdminFixtures from "@/pages/admin/Fixtures";
import MasterConfig from "@/pages/admin/Masterconfig";
import UserManagement from "@/pages/admin/Usermanagement";
import UIElements from "@/pages/UIElements";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LiveConfigProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/event/:id" element={<EventDetail />} />
                <Route path="/payment/result" element={<PaymentResult />} />
                <Route path="/login" element={<Login />} />
                <Route path="/ui-elements" element={<UIElements />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="events" element={<AdminEvents />} />
                  <Route path="events/:eventId" element={<EventEdit />} />
                  <Route path="registrations" element={<AdminRegistrations />} />
                  <Route path="fixtures" element={<AdminFixtures />} />
                  <Route path="config" element={<MasterConfig />} />
                  <Route path="users" element={<UserManagement />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LiveConfigProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
