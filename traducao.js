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
  texto = texto.replace(/\*/g, ''); 
  console.log(texto);
  
  
  const questoes = texto;
  
  
  return questoes;
}
  

async function getMessage(traducao) {
  return `Traduza esse texto para português do Brasil: ${traducao}`;
}

async function run(traducao) {
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
  const prompt = await getMessage(traducao);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const questoesFormatadas = formatarQuestoes(response.text());
  
  return questoesFormatadas;
}

app.post('/traducao', async (req, res) => {
  dataStore[req.user.userId] = {};
  try {
    const { traducao } = req.body;
    const data = await run(traducao);
    dataStore[req.user.userId] = data;
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating response');
  }
});

app.get('/textotraduzido', (req, res) => {
  const data = dataStore[req.user.userId];
  if (!data) {
    return res.status(404).json({ error: 'Tradução não encontrada' });
  }
  res.json(data);
  dataStore[req.user.userId] = {};
});

module.exports = app;