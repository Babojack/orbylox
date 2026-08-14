import React, { useState } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Camera, Mail, Save, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/LanguageProvider";
import OrbyloxMark from "@/components/OrbyloxMark";

const RANDOM_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Max',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Noah',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Liam',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Ella',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Ava',
];

export default function Profile() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    onSuccess: (data) => {
      setFullName(data.full_name || '');
    }
  });

  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: (data) => api.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      await updateProfileMutation.mutateAsync({ avatar_url: file_url });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const generateRandomAvatar = async () => {
    const randomAvatar = RANDOM_AVATARS[Math.floor(Math.random() * RANDOM_AVATARS.length)] + '&t=' + Date.now();
    await updateProfileMutation.mutateAsync({ avatar_url: randomAvatar });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-[#ef5a24] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <OrbyloxMark className="w-9 h-9 shrink-0" />
        <h1 className="text-2xl font-bold text-slate-900">{t('editProfile')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {language === 'de' ? 'Profilinformationen' : 'Profile Information'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="text-2xl bg-[#ef5a24]/10 text-[#ef5a24]">
                  {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#ef5a24] rounded-full flex items-center justify-center cursor-pointer hover:bg-black transition-colors shadow-lg">
                <Camera className="w-4 h-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateRandomAvatar}
                disabled={updateProfileMutation.isPending}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${updateProfileMutation.isPending ? 'animate-spin' : ''}`} />
                {language === 'de' ? 'Zufälliges Bild' : 'Random Avatar'}
              </Button>
            </div>
            {uploading && <p className="text-sm text-slate-500">{language === 'de' ? 'Wird hochgeladen...' : 'Uploading...'}</p>}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">{language === 'de' ? 'Name' : 'Name'}</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={language === 'de' ? 'Dein Name' : 'Your name'}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block flex items-center gap-2">
                <Mail className="w-4 h-4" /> {language === 'de' ? 'E-Mail' : 'Email'}
              </label>
              <Input
                value={user?.email || ''}
                disabled
                className="bg-slate-50"
              />
              <p className="text-xs text-slate-500 mt-1">{language === 'de' ? 'E-Mail kann nicht geändert werden' : 'Email cannot be changed'}</p>
            </div>
          </div>

          {/* Save Button */}
          <Button
            className="w-full bg-[#ef5a24] hover:bg-black"
            onClick={() => updateProfileMutation.mutate({ full_name: fullName })}
            disabled={updateProfileMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {saved ? (language === 'de' ? '✓ Gespeichert!' : '✓ Saved!') : (language === 'de' ? 'Änderungen speichern' : 'Save Changes')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}