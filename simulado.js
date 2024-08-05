const express = require('express');
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
  texto = texto.split('\n').filter(linha => linha.trim() !== '').join('\n');
  console.log(texto);
  
  // Separar as questões
  //const questoesTexto = texto.split("**Questão");
 

  // Array para armazenar as questões formatadas
  const questoes = [];

  const regexQuestao = /\*\*Questão\s(\d+):\*\*\s*([\s\S]*?)\(a\)/g;
  const regexOpcao = /\(([a-e])\)\s(.*?)\n/g;
  const regexResposta = /\*\*Resposta:\*\*\s\(([a-e])\)\s(.*?)\n/g;
  const regexExplicacao = /\*\*Explicação:\*\*\s([\s\S]*?)((?=\*\*Questão)|$)/g;
  
  let match;
  while ((match = regexQuestao.exec(texto)) !== null) {
    let numero = parseInt(match[1], 10);
    let pergunta = match[2].replace(/\n/g, ' ').trim();
    let questao = {
      numero: numero,
      pergunta: pergunta,
      opcoes: [],
      resposta: "",
      explicacao: ""
    };
  
    // Reinicia a busca de opções a partir do início da string da questão
    regexOpcao.lastIndex = match.index;
    let opcoesMatch;
    while ((opcoesMatch = regexOpcao.exec(texto)) !== null) {
      let opcaoCompleta = opcoesMatch[0].trim();
      questao.opcoes.push(opcaoCompleta);
      if (questao.opcoes.length >= 5) break;
    }
  
    let respostaMatch = regexResposta.exec(texto);
    if (respostaMatch && respostaMatch[0]) {
      questao.resposta = respostaMatch[0];
    }
  
    let explicacaoMatch = regexExplicacao.exec(texto);
    if (explicacaoMatch && explicacaoMatch[1]) {
      questao.explicacao = explicacaoMatch[1].trim();
    }
  
    questoes.push(questao);
  }
  console.log(questoes);
  // Verificar se todas as questões foram encontradas
  if (questoes.length !== 10) {
    throw new Error("Não foram retornadas exatamente 10 questões.");
  }
  
  // Verificar se todas as questões atendem aos critérios
  questoes.forEach(q => {
    if (!q.pergunta || q.opcoes.length !== 5 || !q.resposta || !q.explicacao) {
      throw new Error("A questão não atende aos critérios: cada questão deve ter uma pergunta, cinco opções, uma resposta e uma explicação.");
    }
  });


  
  return questoes;
}



async function getMessage(tema, nivel) {
  return `Elabore um questionário com questões de 1 a 10 sem uso de imagens, com alternativas para o tema ${tema} para alunos do ${nivel}, no formato, **Questao** contendo a questao, opções (a) (b) (c) (d) (e) contendo as opções, resposta: contendo a resposta completa, explicação: contendo a explicação. Distribua bem as respostas certas e corrija corretamente.`;
}

async function run(tema, nivel) {
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
  ]
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig, safetySettings});
  const prompt = await getMessage(tema, nivel);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const questoesFormatadas = formatarQuestoes(response.text());
  
  return questoesFormatadas;
}

app.post('/api', async (req, res) => {
  dataStore[req.user.userId] = {};
  try {
    const { tema, nivel } = req.body;
    const data = await run(tema, nivel);
    
   
    dataStore[req.user.userId] = data;
    
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating response');
  }
});

app.get('/simulado', (req, res) => {
  const data = dataStore[req.user.userId];
  // Verifique se há respostas armazenadas
  if (!data) {
    return res.status(404).json({ error: 'Gabarito não encontrado' });
  }

  const formattedData = data.map(questao => ({
    numero: questao.numero,
    pergunta: questao.pergunta,
    opcoes: questao.opcoes,
  }));
  // Envie o gabarito como resposta
  res.json(formattedData);
});

app.post('/respostas', (req, res) => {
  const respostasUsuario = req.body;
  console.log(respostasUsuario);
  const letrasRespostasUsuario = respostasUsuario.map(resposta => {
    const match = resposta.match(/\((\w)\)/);
    return match ? match[1] : null;
  });

  
  const correcao = [];
  const notas = [];
  
    const data = dataStore[req.user.userId];
    const respostas = data.map((questao, index) => {
    const match = questao.resposta.match(/\((\w)\)/);
    const respostaCorreta = match ? match[1] : null;
    const respostaUsuario = letrasRespostasUsuario[index];
    const correcaoQuestao = respostaUsuario === respostaCorreta ? 'certo' : 'errado';
    correcao.push(correcaoQuestao);
    const explicacao = questao.explicacao.replace(/^\*\*Explicação:\*\*\s*/, '');
    
    
    return {
      numero: questao.numero,
      pergunta: questao.pergunta,
      correcao: correcaoQuestao,
      opcoes: questao.opcoes,
      usuario: respostaUsuario,
      resposta: respostaCorreta,
      explicacao: explicacao,
    };
  });
 

 
  
  

  for (let i = 0; i < correcao.length; i++) {
    if(correcao[i] === 'certo'){
      notas.push(1);
    }
    else{
      notas.push(0);
    }
  }

  let nota = 0;
  for (let score of notas){
    nota += score
  }

  const dados = {
    nota: nota,
    respostas: respostas
  }

  dataStore[req.user.userId] = dados
  
  res.json(respostas);
 
});

app.get('/gabarito', (req, res) => {
  const data = dataStore[req.user.userId];
  // Verifique se há respostas armazenadas
  if (!data) {
    return res.status(404).json({ error: 'Gabarito não encontrado' });
  }

  
  
  // Envie o gabarito como resposta
  res.json(data);
  dataStore[req.user.userId] = {};
});


module.exports = app;
