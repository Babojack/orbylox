import React, { useState } from "react";
import { api } from "@/api/apiClient";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const finishLogin = () => {
    const redirect =
      window.localStorage.getItem("orbylox_redirect_after_login") ||
      createPageUrl("ProjectsList");
    window.localStorage.removeItem("orbylox_redirect_after_login");
    navigate(redirect);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please fill in email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        await api.auth.register({ email, password });
      } else {
        await api.auth.login({ email, password });
      }
      finishLogin();
      } catch (err) {
      setError(err && err.message ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    api.auth.demoLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            {mode === "login" ? "Log in to ORBYLOX" : "Create an ORBYLOX account"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-2 mb-4">
            <Button
              variant={mode === "login" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("login")}
            >
              Login
            </Button>
            <Button
              variant={mode === "register" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("register")}
            >
              Register
            </Button>
            <Button variant="outline" size="sm" onClick={handleDemo}>
              Demo
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Login"
                : "Register"}
            </Button>
          </form>
          <p className="text-xs text-slate-400 text-center mt-4">
            For demo use you can click the Demo button without creating an
            account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
