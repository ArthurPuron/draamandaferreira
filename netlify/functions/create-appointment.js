// Arquivo: netlify/functions/create-appointment.js

const { google } = require("googleapis");

const DURACAO_CONSULTA_MINUTOS = 60;
const TIMEZONE = "America/Sao_Paulo";

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  try {
    // Adicionando um cabeçalho para permitir a origem (CORS)
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const { date, time, patientName, patientBirthdate } = JSON.parse(event.body);

    if (!date || !time || !patientName || !patientBirthdate) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Todos os campos são obrigatórios." }),
      };
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    const [hour, minute] = time.split(':');
    const startTime = new Date(`${date}T${hour}:${minute}:00.000-03:00`);
    const endTime = new Date(startTime);
    endTime.setMinutes(startTime.getMinutes() + DURACAO_CONSULTA_MINUTOS);

    const eventDetails = {
      summary: `Consulta Agendada - ${patientName}`,
      description: `Paciente: ${patientName}\nData de Nascimento: ${patientBirthdate}\nAgendado pelo site.`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: TIMEZONE,
      },
    };

    await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: eventDetails,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Agendamento confirmado com sucesso!" }),
    };

  } catch (error) {
    console.error("Erro ao criar evento:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Falha ao criar o agendamento.", details: error.message }),
    };
  }
};
