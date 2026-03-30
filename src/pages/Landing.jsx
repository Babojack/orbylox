import React from 'react';
import { api } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
        ArrowRight, Sparkles, Check, 
        Lightbulb, Clock, Euro, BookOpen, Rocket, MapPin, Languages
      } from 'lucide-react';
      import { Input } from "@/components/ui/input";
import { createPageUrl } from "@/utils";
import { useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import InteractiveFeatureCard from "@/components/landing/InteractiveFeatureCard";

function LandingContent() {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [waitlistEmail, setWaitlistEmail] = React.useState('');
  const [waitlistLoading, setWaitlistLoading] = React.useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = React.useState(false);
  
  const handleGetStarted = () => {
    navigate(createPageUrl('login'));
  };

  const handleWaitlistSubmit = async () => {
    if (!waitlistEmail.trim() || !waitlistEmail.includes('@')) {
      alert('Please enter a valid email');
      return;
    }
    setWaitlistLoading(true);
    try {
      await api.entities.Waitlist.create({ email: waitlistEmail.toLowerCase(), source: 'landing' });
      setWaitlistSuccess(true);
      setWaitlistEmail('');
    } catch (error) {
      console.error('Waitlist error:', error);
      alert('Error joining waitlist');
    } finally {
      setWaitlistLoading(false);
    }
  };

  const features = [
    {
      icon: Clock,
      title: t('min10Onboarding'),
      description: t('min10OnboardingDesc')
    },
    {
      icon: Sparkles,
      title: t('minimalistInterface'),
      description: t('minimalistInterfaceDesc')
    },
    {
      icon: Lightbulb,
      title: t('fromIdeaToPlan'),
      description: t('fromIdeaToPlanDesc')
    },
    {
      icon: Euro,
      title: t('studentFriendlyTitle'),
      description: t('studentFriendlyDescLong')
    },
    {
      icon: BookOpen,
      title: t('ideaValidationIntegrated'),
      description: t('ideaValidationIntegratedDesc')
    }
  ];

  const roadmapData = [
    {
      phase: "Beta",
      status: "live",
      features: [
        { name: t('voiceAssistant'), desc: t('voiceAssistantDesc'), available: true }
      ]
    },
    {
      phase: "Q2 2026",
      status: "soon",
      features: [
        { name: t('ideaAnalyst'), desc: t('ideaAnalystDesc') },
        { name: t('businessAssistant'), desc: t('businessAssistantDesc') }
      ]
    },
    {
      phase: "Q3 2026",
      status: "planned",
      features: [
        { name: t('expertNetwork'), desc: t('expertNetworkDesc') },
        { name: t('gdprCompliantTitle'), desc: t('gdprCompliantDesc') }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white border-b border-slate-100 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-[11px] sm:text-sm lg:text-base font-extrabold tracking-[0.08em] leading-tight text-slate-900">
              ORBYLOX - FREE PROJECT MANAGEMENT FOR EVERYONE
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600 hover:text-slate-900"
              onClick={() => setLanguage(language === 'en' ? 'de' : 'en')}
              title={t('language')}
            >
              <Languages className="w-5 h-5" />
            </Button>
            <Button 
              onClick={handleGetStarted}
              variant="outline" 
              className="border-slate-200 hover:border-indigo-300"
            >
              Login
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-700">{t('forStudentsAndStartups')}</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight animate-fade-in-up">
            {t('planProjects')}
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {t('implementIdeas')}
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-3xl mx-auto leading-relaxed animate-fade-in-up animation-delay-200">
            {t('landingSubtitle')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-12 animate-fade-in-up animation-delay-200">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> 100% Free
            </span>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {t('readyIn10Min')}
            </span>
            <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium flex items-center gap-1">
              <Euro className="w-3.5 h-3.5" /> {t('studentFriendly')}
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-4 mb-12 animate-fade-in-up animation-delay-400">
            <Button 
              onClick={handleGetStarted}
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-200 px-8 py-6 text-lg group"
            >
              {t('startFree')}
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="max-w-4xl mx-auto bg-slate-100 rounded-2xl border border-slate-200 shadow-xl overflow-hidden aspect-video relative">
            <div className="w-full h-full">
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/LeRWiWL-Zmk"
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="py-16 px-6 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">{t('builtForTeamsLikeYou')}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "🎓", title: t('students'), desc: t('studentsDesc') },
              { icon: "🚀", title: t('freshStartups'), desc: t('freshStartupsDesc') },
              { icon: "👫", title: t('friendGroups'), desc: t('friendGroupsDesc') }
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 text-center hover:shadow-lg transition-all">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why OMNIPLACE */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('whatMakesSpecial')}</h2>
            <p className="text-xl text-slate-600">{t('simpleStartGrowTogether')}</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div 
                key={i}
                className="bg-white p-8 rounded-2xl border border-slate-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Module Screenshots - Interactive Cards */}
      <section className="py-20 px-6 bg-slate-50/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('everythingYouNeed')}</h2>
            <p className="text-xl text-slate-600">{t('focusedToolsNoOverload')}</p>
            <p className="text-sm text-indigo-600 mt-2 font-medium">✨ Click cards to try interactive demos!</p>
          </div>
          
          {/* Interactive Feature Cards */}
          <div className="grid md:grid-cols-2 gap-8">
            <InteractiveFeatureCard
              title={`📋 ${t('kanbanBoard')}`}
              description={t('kanbanBoardDesc')}
              features={[t('dragDropInterface'), t('prioritiesDeadlines'), t('teamAssignment')]}
              image="https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&q=80"
              index={0}
            />
            <InteractiveFeatureCard
              title={`💬 ${t('socialFeed')}`}
              description={t('socialFeedDesc')}
              features={[t('postUpdates'), t('likesComments'), t('imageSharing')]}
              image="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80"
              index={1}
            />
            <InteractiveFeatureCard
              title={`📁 ${t('fileHub')}`}
              description={t('fileHubDesc')}
              features={[t('dragDropUpload'), t('folderManagement'), t('filePreview')]}
              image="https://images.unsplash.com/photo-1544396821-4dd40b938ad3?w=800&q=80"
              index={2}
            />
            <InteractiveFeatureCard
              title={`🎨 ${t('canvasTitle')}`}
              description={t('canvasDesc')}
              features={[t('nodesConnections'), t('colorCoding'), t('taskLinking')]}
              image="https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&q=80"
              index={3}
            />
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-full mb-6">
              <Rocket className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-700">{t('roadmap')}</span>
            </div>
            <h2 className="text-4xl font-bold mb-4">{t('ourDevelopment')}</h2>
            <p className="text-xl text-slate-600">{t('whatComesNext')}</p>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">{t('phase')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">{t('feature')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 hidden md:table-cell">{t('descriptionCol')}</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {roadmapData.map((phase, phaseIdx) => (
                  phase.features.map((feature, featureIdx) => (
                    <tr 
                      key={`${phaseIdx}-${featureIdx}`} 
                      className={`border-b border-slate-100 last:border-0 ${phase.status === 'live' ? 'bg-emerald-50/50' : ''}`}
                    >
                      {featureIdx === 0 && (
                        <td 
                          className="px-6 py-4 font-medium text-slate-900 align-top"
                          rowSpan={phase.features.length}
                        >
                          <div className="flex items-center gap-2">
                            {phase.status === 'live' && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
                            {phase.phase}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{feature.name}</div>
                        <div className="text-sm text-slate-500 md:hidden">{feature.desc}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm hidden md:table-cell">{feature.desc}</td>
                      <td className="px-6 py-4 text-center">
                        {phase.status === 'live' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            {t('betaLive')}
                          </span>
                        ) : phase.status === 'soon' ? (
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                            {t('inDevelopment')}
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                            {t('planned')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Waiting List Section */}
      <section className="py-20 px-6 bg-slate-50/50">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Join ORBYLOX</h2>
            <p className="text-xl text-slate-600">Secure your spot on the waiting list</p>
          </div>

          <div className="bg-white p-10 rounded-3xl border-2 border-indigo-500 hover:shadow-2xl transition-all relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full text-sm font-medium shadow-lg">
                Beta Access
              </span>
            </div>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg">
                <Rocket className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">ORBYLOX</h3>
              <p className="text-slate-500">For students, startups &amp; teams</p>
            </div>
            
            {waitlistSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
                <h4 className="text-xl font-bold text-emerald-700 mb-2">
                  🎉 You're on the list!
                </h4>
                <p className="text-slate-600">
                  We'll be in touch!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Input 
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleWaitlistSubmit()}
                  placeholder="your@email.com"
                  className="w-full py-6 text-lg text-center"
                  disabled={waitlistLoading}
                />
                <Button 
                  onClick={handleWaitlistSubmit}
                  disabled={waitlistLoading || !waitlistEmail.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-6 text-lg shadow-lg"
                >
                  {waitlistLoading ? 'Joining...' : 'Join waiting list'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            )}
            <p className="text-center text-sm text-slate-400 mt-4">
              No signup required – just enter your email
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            {t('readyToImplementIdea')}
          </h2>
          <p className="text-xl text-indigo-100 mb-12">
            {t('startFreeNoCreditCard')}
          </p>
          <Button 
            onClick={handleGetStarted}
            size="lg"
            className="bg-white text-indigo-700 hover:bg-indigo-50 shadow-2xl px-12 py-8 text-xl group"
          >
            {t('startFreeNow')}
            <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-12 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto text-center text-slate-600">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="text-[11px] sm:text-sm font-extrabold tracking-[0.08em] leading-tight text-slate-900">
              ORBYLOX - FREE PROJECT MANAGEMENT FOR EVERYONE
            </div>
          </div>
          <p className="text-sm mb-2">© 2024 ORBYLOX. {t('simplestToolForStartups')}</p>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3" /> {t('hostedInGermany')}
          </p>
          <div className="mt-4">
            <a href="/Impressum" className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">
              Legal Notice
            </a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }
        .animation-delay-200 {
          animation-delay: 0.2s;
          opacity: 0;
          animation-fill-mode: forwards;
        }
        .animation-delay-400 {
          animation-delay: 0.4s;
          opacity: 0;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}

export default function Landing() {
  return (
    <LanguageProvider>
      <LandingContent />
    </LanguageProvider>
  );
}