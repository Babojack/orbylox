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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-8">
      <Card className="w-full max-w-md shadow-2xl border-2 border-slate-200">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">O</span>
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-bold text-slate-900">
            {mode === "login" ? "Log in" : "Create account"}
          </CardTitle>
          <p className="text-center text-slate-500 text-sm">
            {mode === "login"
              ? "Enter your email and password."
              : "Register with your email and a password."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("login")}
            >
              Login
            </Button>
            <Button
              type="button"
              variant={mode === "register" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("register")}
            >
              Register
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDemo}>
              Demo
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 text-base border-slate-300"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 text-base border-slate-300"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 text-center bg-red-50 py-2 px-3 rounded-md border border-red-100">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-11 text-base bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              disabled={loading}
            >
              {loading ? "Please wait..." : mode === "login" ? "Log in" : "Register"}
            </Button>
          </form>
          <p className="text-xs text-slate-500 text-center">
            Use <strong>Demo</strong> to try without an account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
