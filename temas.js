const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const app = express();

require('dotenv').config();
app.use(express.json());



const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

function formatarQuestoes(texto) {
  console.log(texto);
  const regex = /\*\*(.*?)\*\*/g;
  const matches = texto.match(regex);
  
  if (!matches) {
    return []; // Retorna um array vazio se não houver correspondências
  }
  
  // Filtrar e limpar os temas encontrados
  const temasArray = matches.map(match => {
    // Remover asteriscos
    let temaLimpo = match.replace(/\*\*/g, '');
    // Remover números e espaços no início de cada tema
    temaLimpo = temaLimpo.replace(/^\d+\.\s+/g, '');
    // Remover dois pontos
    temaLimpo = temaLimpo.replace(/:/g, '');
    // Remover espaços em branco no início e no fim
    temaLimpo = temaLimpo.trim();
    
    return temaLimpo;
  });
  const temasFiltrados = temasArray.filter(tema => tema !== '');

  return temasFiltrados;
}

  
  
  

async function getMessage(curso, nivel) {
    let pergunta;
    if((curso === '') || (curso === null)){
        pergunta = `Liste 10 temas que são abordados hoje em dia no ${nivel}, sem abordagens ou explicações e sem enumerar os temas. Devolva cada tema entre **`;
    }else{
        pergunta = `Liste 10 temas, sem abordagens ou explicações e sem enumerar os temas, que sejam diversificados e atuais, abordados no ${nivel} para o curso de ${curso}. Devolva cada tema entre **`;
    }
  return pergunta;
}

async function run(curso, nivel) {
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
  const prompt = await getMessage(curso, nivel);
  console.log('prompt:', prompt);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const questoesFormatadas = formatarQuestoes(response.text());
  return questoesFormatadas;
}

app.post('/temas', async (req, res) => {
  try {
    const { curso, nivel } = req.body;
    const data = await run(curso, nivel);
    console.log(data);
    
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating response');
  }
});



module.exports = app;