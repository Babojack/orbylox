import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, event } = await req.json();

    // Get Google Calendar access token
    const accessToken = await client.asServiceRole.connectors.getAccessToken("googlecalendar");

    if (action === 'createEvent') {
      // Create event in Google Calendar
      const googleEvent = {
        summary: event.title,
        description: event.description || '',
        start: event.all_day 
          ? { date: event.start_date.split('T')[0] }
          : { dateTime: event.start_date, timeZone: 'Europe/Berlin' },
        end: event.all_day
          ? { date: (event.end_date || event.start_date).split('T')[0] }
          : { dateTime: event.end_date || event.start_date, timeZone: 'Europe/Berlin' },
        attendees: event.attendees?.map(email => ({ email })) || [],
        sendUpdates: 'all' // Send email invitations to attendees
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(googleEvent)
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return Response.json({ error: `Google Calendar error: ${error}` }, { status: 400 });
      }

      const createdEvent = await response.json();
      return Response.json({ 
        success: true, 
        googleEventId: createdEvent.id,
        htmlLink: createdEvent.htmlLink 
      });
    }

    if (action === 'updateEvent') {
      const googleEvent = {
        summary: event.title,
        description: event.description || '',
        start: event.all_day 
          ? { date: event.start_date.split('T')[0] }
          : { dateTime: event.start_date, timeZone: 'Europe/Berlin' },
        end: event.all_day
          ? { date: (event.end_date || event.start_date).split('T')[0] }
          : { dateTime: event.end_date || event.start_date, timeZone: 'Europe/Berlin' },
        attendees: event.attendees?.map(email => ({ email })) || []
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.googleEventId}?sendUpdates=all`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(googleEvent)
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return Response.json({ error: `Google Calendar error: ${error}` }, { status: 400 });
      }

      return Response.json({ success: true });
    }

    if (action === 'deleteEvent') {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.googleEventId}?sendUpdates=all`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok && response.status !== 404) {
        const error = await response.text();
        return Response.json({ error: `Google Calendar error: ${error}` }, { status: 400 });
      }

      return Response.json({ success: true });
    }

    if (action === 'listEvents') {
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return Response.json({ error: `Google Calendar error: ${error}` }, { status: 400 });
      }

      const data = await response.json();
      return Response.json({ events: data.items || [] });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});