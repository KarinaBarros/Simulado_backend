const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const app = express();

require('dotenv').config();
app.use(express.json());

let formattedData;

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
  

async function getMessage(resumo) {
  return `Faça o resumo desse texto: ${resumo}`;
}

async function run(resumo) {
  const generationConfig = {
    temperature: 0.6,
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
  const prompt = await getMessage(resumo);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const questoesFormatadas = formatarQuestoes(response.text());
  formattedData = questoesFormatadas;
  return questoesFormatadas;
}

app.post('/resumo', async (req, res) => {
  try {
    const { resumo } = req.body;
    const data = await run(resumo);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating response');
  }
});

app.get('/textoresumido', (req, res) => {
  if (!formattedData) {
    return res.status(404).json({ error: 'Correção não encontrada' });
  }
  console.log(formattedData);
  res.json(formattedData);
});

module.exports = app;