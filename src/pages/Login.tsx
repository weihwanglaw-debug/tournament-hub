import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Login is now handled by LoginModal in the Header.
// This page redirects authenticated users to /admin, otherwise to home.
export default function Login() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/admin", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return null;
}
