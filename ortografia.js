const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const app = express();

require('dotenv').config();
app.use(express.json());

let formattedData;

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
  
  
  const questoes = texto;
  
  
  return questoes;
}
  

async function getMessage(ortografia) {
  return `Corrija a ortografia desse texto em português do Brasil: ${ortografia}. Devolva o texto com as todas as palavras que foram corrigidas ou acentuadas entre ** e não inclua este parágrafo`;
}

async function run(ortografia) {
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
  const prompt = await getMessage(ortografia);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const questoesFormatadas = formatarQuestoes(response.text());
  
  return questoesFormatadas;
}

app.post('/ortografia', async (req, res) => {
  try {
    const { ortografia } = req.body;
    const data = await run(ortografia);
    dataStore[req.user.userId] = data;
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating response');
  }
});

app.get('/correcao', (req, res) => {
  const data = dataStore[req.user.userId];
  if (!data) {
    return res.status(404).json({ error: 'Correção não encontrada' });
  }
  res.json(data);
});

module.exports = app;