import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from "@/api/apiClient";
import { eventRoomName, roomUrl, roomFromUrl, meetingPageUrl } from "@/lib/meetingRoom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { de as dateDe, enUS as dateEn } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, CalendarDays, Loader2, UserPlus, Video } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageProvider";
import { Reveal } from "@/components/motion/Reveal";

const EVENT_COLORS = [
  { value: '#ef5a24', label: 'Orange' },
  { value: '#22c55e', label: 'Grün' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#0a0a0a', label: 'Schwarz' },
  { value: '#ef4444', label: 'Rot' },
];

export default function Calendar() {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? dateEn : dateDe;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    all_day: true,
    color: '#6366f1',
    attendees: [],
    video_enabled: false,
    video_url: ''
  });
  const [attendeeInput, setAttendeeInput] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);

  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get('project');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', projectId],
    queryFn: async () => {
      const all = await api.entities.Event.filter({ project_id: projectId }, '-start_date', 200);
      return all;
    },
    enabled: !!projectId,
    staleTime: 30000
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const all = await api.entities.Project.list();
      return all.find(p => p.id === projectId);
    },
    enabled: !!projectId
  });

  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false
  });

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (userError || (!userLoading && !currentUser)) {
      api.auth.redirectToLogin(window.location.pathname);
    }
  }, [currentUser, userLoading, userError]);

  /** Sends one invitation per attendee; failures are collected, not thrown away. */
  const sendEventInvites = async (eventData) => {
    const attendees = (eventData.attendees || []).filter((a) => a && a.includes('@'));
    if (attendees.length === 0) return { sent: 0, failed: [] };

    const payloadBase = {
      type: 'event',
      projectId,
      appUrl: window.location.origin,
      language: 'de',
      projectName: project?.name || '',
      inviterName: currentUser?.full_name || currentUser?.displayName || currentUser?.email || '',
      event: {
        title: eventData.title,
        description: eventData.description || '',
        start: eventData.start_date,
        end: eventData.end_date,
        all_day: !!eventData.all_day,
        video_url: eventData.video_url || '',
      },
    };

    const failed = [];
    let sent = 0;
    for (const to of attendees) {
      try {
        await api.integrations.Core.SendEmail({ ...payloadBase, to });
        sent += 1;
      } catch (err) {
        console.error('[Kalender] Einladung fehlgeschlagen:', to, err?.message || err);
        failed.push(`${to}: ${err?.message || 'unbekannter Fehler'}`);
      }
    }
    return { sent, failed };
  };

  const createEventMutation = useMutation({
    mutationFn: async (eventData) => {
      const event = await api.entities.Event.create({ ...eventData, project_id: projectId });
      const result = await sendEventInvites(eventData);
      return { event, ...result };
    },
    onSuccess: ({ sent, failed }) => {
      queryClient.invalidateQueries(['events', projectId]);
      setIsEventDialogOpen(false);
      resetEventForm();
      if (failed.length > 0) {
        window.alert(`Termin gespeichert.\n\n⚠️ ${failed.length} Einladung(en) konnten nicht gesendet werden:\n${failed.join('\n')}`);
      } else if (sent > 0) {
        window.alert(`Termin gespeichert und ${sent} Einladung(en) verschickt.`);
      }
    },
    onError: (err) => {
      window.alert(`Termin konnte nicht gespeichert werden: ${err?.message || 'Unbekannter Fehler'}`);
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (eventData) => {
      await api.entities.Event.update(eventData.id, eventData);
      // Re-send so attendees get the corrected time and the meeting link.
      return sendEventInvites(eventData);
    },
    onSuccess: ({ failed }) => {
      queryClient.invalidateQueries(['events', projectId]);
      setEditingEvent(null);
      setIsEventDialogOpen(false);
      resetEventForm();
      if (failed.length > 0) {
        window.alert(`Termin aktualisiert.\n\n⚠️ Einladungen fehlgeschlagen:\n${failed.join('\n')}`);
      }
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (event) => {
      await api.entities.Event.delete(event.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['events', projectId]);
      setEditingEvent(null);
      setIsEventDialogOpen(false);
      resetEventForm();
    }
  });

  const resetEventForm = () => {
    setNewEvent({ title: '', description: '', start_date: '', end_date: '', all_day: true, color: '#6366f1', attendees: [], video_enabled: false, video_url: '' });
    setAttendeeInput('');
  };

  const addAttendee = () => {
    if (attendeeInput && attendeeInput.includes('@') && !newEvent.attendees.includes(attendeeInput)) {
      setNewEvent({ ...newEvent, attendees: [...newEvent.attendees, attendeeInput] });
      setAttendeeInput('');
    }
  };

  const removeAttendee = (email) => {
    setNewEvent({ ...newEvent, attendees: newEvent.attendees.filter(a => a !== email) });
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day) => {
    return events.filter(event => {
      const eventStart = new Date(event.start_date);
      const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;
      return day >= new Date(eventStart.toDateString()) && day <= new Date(eventEnd.toDateString());
    });
  };

  const openNewEventDialog = (date) => {
    setEditingEvent(null);
    setSelectedDate(date);
    setNewEvent({
      title: '',
      description: '',
      start_date: format(date, "yyyy-MM-dd'T'09:00"),
      end_date: format(date, "yyyy-MM-dd'T'10:00"),
      all_day: true,
      color: '#6366f1',
      attendees: [],
      video_enabled: false,
      video_url: ''
    });
    setIsEventDialogOpen(true);
  };

  const openEditEventDialog = (event) => {
    setEditingEvent(event);
    setNewEvent({
      title: event.title,
      description: event.description || '',
      start_date: event.start_date?.slice(0, 16) || '',
      end_date: event.end_date?.slice(0, 16) || '',
      all_day: event.all_day || false,
      color: event.color || '#ef5a24',
      attendees: event.attendees || [],
      video_enabled: !!event.video_url,
      video_url: event.video_url || ''
    });
    setIsEventDialogOpen(true);
  };

  /** One room per event, so parallel meetings never collide. */
  const buildMeetingUrl = () => roomUrl(eventRoomName(projectId));

  const withMeeting = (eventData) => {
    if (!eventData.video_enabled) return { ...eventData, video_url: '' };
    return { ...eventData, video_url: eventData.video_url || buildMeetingUrl() };
  };

  const weekDays =
    language === 'en'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  if (userLoading || !currentUser) {
    return <div className="flex items-center justify-center h-[50vh] text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">{t('calendar')}</h2>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-8">
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <span className="text-sm">{t('calendarLoading')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t('calendar')}</h2>
        <Button onClick={() => openNewEventDialog(new Date())} className="bg-[#ef5a24] hover:bg-black min-h-[44px]">
          <Plus className="w-4 h-4 mr-2" /> {t('newEvent')}
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h3 className="text-lg font-semibold text-slate-800">
            {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
          </h3>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Handy: Termine als Liste statt als Raster */}
        <div className="md:hidden divide-y divide-slate-100">
          {(() => {
            const monthDays = days.filter((d) => isSameMonth(d, currentDate));
            const withEvents = monthDays.filter((d) => getEventsForDay(d).length > 0);

            if (withEvents.length === 0) {
              return (
                <div className="px-4 py-10 text-center">
                  <CalendarDays className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500">{t('noEventsThisMonth')}</p>
                  <button
                    type="button"
                    onClick={() => openNewEventDialog(new Date())}
                    className="mt-4 h-11 px-4 border-2 border-black bg-white text-xs font-bold uppercase"
                  >
                    {t('newEvent')}
                  </button>
                </div>
              );
            }

            return withEvents.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const today = isSameDay(day, new Date());
              return (
                <Reveal key={day.toISOString()} index={i} className="px-3 py-3">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => openNewEventDialog(day)}
                      className="shrink-0 w-12 h-12 flex flex-col items-center justify-center border-2 bg-white p-0"
                      style={{ borderColor: today ? '#ef5a24' : '#e2e8f0' }}
                      aria-label={format(day, 'PPP', { locale: dateLocale })}
                    >
                      <span className={`text-base font-bold leading-none ${today ? 'text-[#ef5a24]' : 'text-slate-800'}`}>
                        {format(day, 'd')}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">
                        {format(day, 'EEE', { locale: dateLocale })}
                      </span>
                    </button>

                    <ul className="flex-1 min-w-0 space-y-1.5">
                      {dayEvents.map((event) => (
                        <li key={event.id}>
                          <button
                            type="button"
                            onClick={() => openEditEventDialog(event)}
                            className="w-full text-left flex items-center gap-2 px-2.5 min-h-[44px] py-2 border-0"
                            style={{ backgroundColor: (event.color || '#ef5a24') + '1a' }}
                          >
                            <span
                              className="w-1.5 self-stretch shrink-0"
                              style={{ backgroundColor: event.color || '#ef5a24' }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-slate-800 truncate">
                                {event.title}
                              </span>
                              {event.start_date && (
                                <span className="block text-[11px] text-slate-500">
                                  {event.all_day
                                    ? t('allDay')
                                    : format(new Date(event.start_date), 'HH:mm', { locale: dateLocale })}
                                </span>
                              )}
                            </span>
                            {event.video_url && (
                              <Link
                                to={meetingPageUrl(projectId, roomFromUrl(event.video_url))}
                                onClick={(e) => e.stopPropagation()}
                                title={t('joinVideoInApp')}
                                className="shrink-0 w-9 h-9 flex items-center justify-center bg-[#ef5a24] text-white"
                              >
                                <Video className="w-4 h-4" />
                              </Link>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              );
            });
          })()}
        </div>

        {/* Weekday Headers */}
        <div className="hidden md:grid grid-cols-7 border-b border-slate-100">
          {weekDays.map(day => (
            <div key={day} className="py-2 text-center text-xs font-medium text-slate-500 uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Monatsraster — erst ab Tablet, auf dem Handy waeren die Zellen 53px breit */}
        <div className="hidden md:grid grid-cols-7">
          {days.map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                onClick={() => openNewEventDialog(day)}
                className={`
                  min-h-[100px] p-2 border-b border-r border-slate-100 cursor-pointer
                  hover:bg-slate-50 transition-colors
                  ${!isCurrentMonth ? 'bg-slate-50/50' : ''}
                `}
              >
                <div className={`
                  w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1
                  ${isToday ? 'bg-[#ef5a24] text-white font-bold' : ''}
                  ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                `}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditEventDialog(event);
                      }}
                      className="text-xs px-2 py-1 rounded text-white cursor-pointer hover:opacity-80 flex items-center gap-1"
                      style={{ backgroundColor: event.color || '#ef5a24' }}
                    >
                      {event.video_url && (
                        <Link
                          to={meetingPageUrl(projectId, roomFromUrl(event.video_url))}
                          onClick={(e) => e.stopPropagation()}
                          title={t('joinVideoInApp')}
                          className="shrink-0 hover:scale-110 transition-transform"
                        >
                          <Video className="w-3 h-3" />
                        </Link>
                      )}
                      <span className="truncate">{event.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-slate-500 px-2">
                      +{dayEvents.length - 3} mehr
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={(open) => {
        setIsEventDialogOpen(open);
        if (!open) {
          setEditingEvent(null);
          resetEventForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Termin bearbeiten' : 'Neuer Termin'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder={t('eventTitle')}
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            />
            <Textarea
              placeholder={t('eventDescription')}
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">{t('eventStart')}</label>
                <Input
                  type="datetime-local"
                  value={newEvent.start_date}
                  onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1 block">{t('eventEnd')}</label>
                <Input
                  type="datetime-local"
                  value={newEvent.end_date}
                  onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                />
              </div>
            </div>
            {/* Attendees */}
            <div>
              <label className="text-sm text-slate-600 mb-1 block flex items-center gap-1">
                <UserPlus className="w-4 h-4" /> Teilnehmer einladen
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com"
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAttendee())}
                />
                <Button type="button" variant="outline" onClick={addAttendee}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {newEvent.attendees.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newEvent.attendees.map(email => (
                    <Badge key={email} variant="secondary" className="flex items-center gap-1">
                      {email}
                      <button onClick={() => removeAttendee(email)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Einladung kommt per E-Mail von invite@orbylox.de — mit Kalenderdatei und Konferenzlink
              </p>
            </div>

            <div>
              <label className="text-sm text-slate-600 mb-1 block">{t('eventColor')}</label>
              <div className="flex gap-2">
                {EVENT_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setNewEvent({ ...newEvent, color: color.value })}
                    className={`w-8 h-8 rounded-full border-2 ${newEvent.color === color.value ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>
            {/* Videokonferenz */}
            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!newEvent.video_enabled}
                  onChange={(e) => setNewEvent({ ...newEvent, video_enabled: e.target.checked })}
                  className="mt-1 w-4 h-4 accent-[#ef5a24]"
                />
                <span>
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Video className="w-4 h-4 text-[#ef5a24]" />
                    Videokonferenz hinzufügen
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Erzeugt einen eigenen Konferenzraum für diesen Termin. Der Link steht danach im Termin und in der Einladung.
                  </span>
                </span>
              </label>

              {newEvent.video_enabled && newEvent.video_url && (
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                  <span className="text-xs text-slate-600 truncate flex-1">{newEvent.video_url}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => navigator.clipboard?.writeText(newEvent.video_url)}
                  >
                    Kopieren
                  </Button>
                </div>
              )}
            </div>

            {editingEvent ? (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => deleteEventMutation.mutate(editingEvent)}
                  disabled={deleteEventMutation.isPending}
                  className="flex-1"
                >
                  {deleteEventMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Löschen'}
                </Button>
                <Button
                  className="flex-1 bg-[#ef5a24] hover:bg-black"
                  onClick={() => updateEventMutation.mutate(withMeeting({ ...editingEvent, ...newEvent }))}
                  disabled={!newEvent.title.trim() || updateEventMutation.isPending}
                >
                  {updateEventMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Speichern...</>
                  ) : (
                    'Speichern'
                  )}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full bg-[#ef5a24] hover:bg-black"
                onClick={() => createEventMutation.mutate(withMeeting(newEvent))}
                disabled={!newEvent.title.trim() || createEventMutation.isPending}
              >
                {createEventMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Wird erstellt...</>
                ) : (
                  <><CalendarDays className="w-4 h-4 mr-2" /> Termin erstellen & Einladen</>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}