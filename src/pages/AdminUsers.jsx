import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createPageUrl } from "@/utils";

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => api.auth.isAdmin(),
    enabled: !!currentUser,
  });

  const {
    data: users = [],
    isLoading: usersLoading,
    refetch: refetchUsers,
    error: usersError,
  } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: () => api.auth.listUsers(),
    enabled: !!isAdmin,
  });

  const setPlanMutation = useMutation({
    mutationFn: ({ email, plan }) => api.auth.setUserPlan({ email, plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.email || "").toLowerCase().includes(q));
  }, [search, users]);

  if (userLoading || adminLoading) {
    return <div className="flex items-center justify-center h-[40vh] text-slate-500">Laden...</div>;
  }

  if (!currentUser) {
    window.location.href = createPageUrl("login");
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Card className="p-6 border-red-200 bg-red-50">
          <h2 className="text-xl font-semibold text-red-800">Kein Zugriff</h2>
          <p className="text-red-700 mt-2">
            Diese Seite ist nur fuer Admins verfuegbar.
          </p>
          <Button className="mt-4" onClick={() => (window.location.href = createPageUrl("ProjectsList"))}>
            Zurueck zu Projekten
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Panel</h2>
          <p className="text-slate-500">Benutzerplaene verwalten (Basic / Premium)</p>
        </div>
        <Button variant="outline" onClick={() => refetchUsers()}>
          Neu laden
        </Button>
      </div>

      <Card className="p-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nach E-Mail suchen..."
        />
      </Card>

      {usersError ? (
        <Card className="p-4 border-red-200 bg-red-50 text-red-700">
          Benutzer konnten nicht geladen werden: {usersError.message}
        </Card>
      ) : usersLoading ? (
        <div className="text-slate-500 py-10 text-center">Benutzer werden geladen...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-slate-500 text-center">Keine Benutzer gefunden.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <Card key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{u.email}</p>
                <Badge className={u.plan === "premium" ? "bg-purple-600" : "bg-slate-500"}>
                  {u.plan === "premium" ? "Premium" : "Basic"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={u.plan === "basic" ? "default" : "outline"}
                  disabled={setPlanMutation.isPending}
                  onClick={() => setPlanMutation.mutate({ email: u.email, plan: "basic" })}
                >
                  Basic
                </Button>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={setPlanMutation.isPending}
                  onClick={() => setPlanMutation.mutate({ email: u.email, plan: "premium" })}
                >
                  Premium
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
