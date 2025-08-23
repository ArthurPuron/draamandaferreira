const { google } = require("googleapis");

// Configurações da consulta - VOCÊ PODE AJUSTAR AQUI SE PRECISAR
const HORARIO_INICIO = 8; // 8:00
const HORARIO_FIM = 18; // 18:00 (o último horário será às 17:00)
const DURACAO_CONSULTA_MINUTOS = 60; // Duração de cada consulta

exports.handler = async (event, context) => {
  // Pega a data enviada pelo site (ex: 2025-08-23)
  const { date } = event.queryStringParameters;

  if (!date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "A data é obrigatória." }),
    };
  }

  try {
    // Autentica com as credenciais seguras que guardamos na Netlify
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Formata a chave corretamente
      },
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    // Define o período de um dia inteiro para a consulta
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Pede ao Google os eventos (horários ocupados) para aquele dia
    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const busySlots = response.data.items.map(event => ({
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
    }));

    // Lógica para encontrar os horários livres
    const availableSlots = [];
    const slotDate = new Date(date);

    for (let hour = HORARIO_INICIO; hour < HORARIO_FIM; hour++) {
      for (let minute = 0; minute < 60; minute += DURACAO_CONSULTA_MINUTOS) {
        const slotStart = new Date(slotDate);
        slotStart.setUTCHours(hour, minute, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotStart.getMinutes() + DURACAO_CONSULTA_MINUTOS);

        // Verifica se o slot está no futuro
        if (slotStart < new Date()) {
          continue;
        }

        // Verifica se o slot está ocupado
        let isBusy = false;
        for (const busy of busySlots) {
          if (slotStart < busy.end && slotEnd > busy.start) {
            isBusy = true;
            break;
          }
        }

        if (!isBusy) {
          const timeString = slotStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
          availableSlots.push(timeString);
        }
      }
    }

    // Retorna a lista de horários livres para o site
    return {
      statusCode: 200,
      body: JSON.stringify({ slots: availableSlots }),
    };

  } catch (error) {
    console.error("Erro ao acessar a API do Google Calendar:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Não foi possível buscar os horários." }),
    };
  }
};
