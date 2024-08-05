const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const app = express();

require('dotenv').config();
app.use(express.json());

let dataStore = {};

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

function formatarQuestoes(texto) {
  console.log(texto);

  const regexNota = /\*\*Nota\s*:\*\*\s*([\s\S]*?)(?=\*\*Comentário|\n)/g;
  const regexComentario = /\*\*Comentário\s*:\*\*\s*([\s\S]*)/g;
  const notaMatch = regexNota.exec(texto);
  const comentarioMatch = regexComentario.exec(texto);

  const questoes = {
    nota: notaMatch ? notaMatch[1].trim() : null,
    comentario: comentarioMatch ? comentarioMatch[1].replace(/\*/g, '').trim() : null,
  };
  
  
  return questoes;
}
  

async function getMessage(redacao) {
  return `Faça uma análise dessa redação, dizendo como pode ser melhorada e atribua uma nota de 1 a 10: ${redacao} Devolva no formato **Nota:** contendo a nota e **Comentário** com a análise. Comentário e nota devem estar entre**`;
}

async function run(redacao) {
  const generationConfig = {
    temperature: 0.5,
  };
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig, safetySettings });
  const prompt = await getMessage(redacao);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const questoesFormatadas = formatarQuestoes(response.text());
  
  return questoesFormatadas;
}

app.post('/redacao', async (req, res) => {
  dataStore[req.user.userId] = {};
  try {
    const { redacao } = req.body;
    const data = await run(redacao);
    dataStore[req.user.userId] = data;
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating response');
  }
});

app.get('/analise', (req, res) => {
  const data = dataStore[req.user.userId];
  if (!data) {
    return res.status(404).json({ error: 'Correção não encontrada' });
  }
  res.json(data);
  dataStore[req.user.userId] = {};
});

module.exports = app;