import React, { useEffect } from 'react';
import { api } from '@/api/apiClient';
import { createPageUrl } from '@/utils';
import { Loader2 } from 'lucide-react';

export default function Login() {
  useEffect(() => {
    api.auth.redirectToLogin(createPageUrl('ProjectsList'));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-slate-600">Redirecting to login...</p>
      </div>
    </div>
  );
}
