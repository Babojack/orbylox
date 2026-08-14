import React from 'react';
import { api } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Check, Star, Zap, Crown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import OrbyloxMark from "@/components/OrbyloxMark";

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 'TBA',
    period: '',
    description: 'Für den Einstieg',
    icon: Star,
    comingSoon: true,
    features: [
      '3 Projekte',
      '5 Team-Mitglieder',
      '1 GB Speicher',
      'Basis-Support',
    ],
    color: 'bg-slate-100 text-slate-700',
    buttonVariant: 'outline',
  },
  {
    id: 'student',
    name: 'Studentenpaket',
    price: 'TBA',
    period: '',
    description: 'Für Studierende & Uni-Projekte',
    icon: Zap,
    popular: true,
    comingSoon: true,
    features: [
      'Unbegrenzte Projekte',
      '10 Team-Mitglieder',
      '10 GB Speicher',
      'Priority Support',
      'Studentenrabatt',
      'Edu-Verifizierung',
    ],
    color: 'bg-[#ef5a24] text-white',
    buttonVariant: 'default',
  },
  {
    id: 'startup',
    name: 'Fresh Baked Startup',
    price: 'TBA',
    period: '',
    description: 'Für junge Startups',
    icon: Crown,
    comingSoon: true,
    features: [
      'Alles aus Studentenpaket',
      'Unbegrenzte Mitglieder',
      '50 GB Speicher',
      'Priority Support',
      'Erweiterte Integrationen',
      'Analytics Dashboard',
    ],
    color: 'bg-amber-500 text-white',
    buttonVariant: 'outline',
  },
];

export default function Subscription() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me()
  });

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!isLoading && !user) {
      api.auth.redirectToLogin(window.location.href);
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ef5a24]"></div>
      </div>
    );
  }

  if (!user) return null;

  const currentPlan = user?.subscription_plan || 'free';

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <OrbyloxMark className="w-10 h-10" />
          <span className="text-xl font-extrabold tracking-tight text-slate-900">RBYLOX</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Wähle deinen Plan</h1>
        <p className="text-slate-600">Finde den perfekten Plan für dein Team</p>
      </div>

      {/* Current Plan Badge */}
      <div className="flex justify-center">
        <Badge variant="outline" className="px-4 py-2 text-sm">
          <CreditCard className="w-4 h-4 mr-2" />
          Aktueller Plan: <span className="font-semibold ml-1 capitalize">{currentPlan}</span>
        </Badge>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          const Icon = plan.icon;

          return (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? 'border-[#ef5a24] border-2 shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[#ef5a24]">Empfohlen</Badge>
                </div>
              )}
              {plan.comingSoon && (
                <div className="absolute top-3 right-3">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Coming Soon</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className={`w-12 h-12 rounded-xl ${plan.color} flex items-center justify-center mx-auto mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button 
                  className={`w-full ${plan.popular ? 'bg-[#ef5a24] hover:bg-black' : ''}`}
                  variant={plan.buttonVariant}
                  disabled={plan.comingSoon || isCurrentPlan}
                >
                  {plan.comingSoon ? 'Coming Soon' : isCurrentPlan ? 'Aktueller Plan' : 'Auswählen'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ or Info */}
      <div className="text-center text-sm text-slate-500">
        <p>Alle Pläne beinhalten eine 14-tägige Geld-zurück-Garantie.</p>
        <p className="mt-1">Fragen? Kontaktiere uns unter support@omniplace.com</p>
      </div>
    </div>
  );
}