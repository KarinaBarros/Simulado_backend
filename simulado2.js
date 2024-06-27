const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const app = express();

require('dotenv').config();
app.use(express.json());

let formattedData;
let questoesCompletas;

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

function formatarQuestoes(texto) {
  texto = texto.replace(/\r\n/g, '\n'); // Normaliza quebras de linha
  console.log(texto);
  
  const regexQuestao = /\*\*Questão\s(\d+):\*\*\s*([\s\S]*?)(?=\*\*Questão\s\d+:|$)/g;
  const questoes = [];
  
  const matches = texto.matchAll(regexQuestao);
  
  for (const match of matches) {
    const numeroQuestao = match[1];
    const textoQuestao = match[2].trim();
    questoes.push({
      numero: numeroQuestao,
      pergunta: textoQuestao
    });
  }
  
  if (questoes.length !== 10) {
    throw new Error("Não foram retornadas exatamente 10 questões.");
  }
  
  return questoes;
}

async function getMessage(tema, nivel) {
  return `Elabore um questionário com questões de 1 a 10 sem uso de imagens, para o tema ${tema} para o ${nivel}, no formato, **Questao** contendo a questao.`;
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
  ];
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig, safetySettings });
  const prompt = await getMessage(tema, nivel);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const questoesFormatadas = formatarQuestoes(response.text());
  formattedData = questoesFormatadas;
  return questoesFormatadas;
}

app.post('/discursiva', async (req, res) => {
  try {
    const { tema, nivel } = req.body;
    const data = await run(tema, nivel);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating response');
  }
});

app.get('/simuladoDiscursivo', (req, res) => {
  if (!formattedData) {
    return res.status(404).json({ error: 'Simulado não encontrado.' });
  }
  console.log(formattedData);
  res.json(formattedData);
});

app.post('/respostasDiscursivo', (req, res) => {
  const respostas = req.body;
  
  if (!formattedData || formattedData.length === 0) {
    return res.status(404).json({ error: 'Não há perguntas formatadas disponíveis.' });
  }
  
  questoesCompletas = [];
  
  formattedData.forEach((perguntaFormatada) => {
    const respostaCorrespondente = respostas.find((resposta) => resposta.numero === perguntaFormatada.numero);
    if (respostaCorrespondente) {
      const perguntaCompleta = {
        numero: perguntaFormatada.numero,
        pergunta: perguntaFormatada.pergunta,
        respostaCliente: respostaCorrespondente.resposta
      };
      questoesCompletas.push(perguntaCompleta);
    }
  });
  
  console.log(questoesCompletas);
  res.send('Respostas recebidas com sucesso');
});

async function fazerNovaPergunta() {
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

  const questoesTexto = questoesCompletas.map((questao) => {
    return `${questao.numero}. ${questao.pergunta} /n Resposta: ${questao.respostaCliente}`;
  }).join('\n');

  const novoPrompt = `Corrija essa prova. No formato **Correção:** contendo certo quanto a resposta for interpretada como certa, errado quando a resposta estiver vazia ou não ter nada a ver com o contexto ou estiver errada, ou meio-certo quando a resposta estiver parcialmente certa, **Resposta:** contendo a resposta correta, **Valor:** contendo um valor de 0 a 1: \n${questoesTexto}`;

  try {
    const result = await model.generateContent(novoPrompt);
    const response = await result.response;
    const perguntaNova = {
      pergunta: response.text().trim()
    };
    console.log(novoPrompt);
    return perguntaNova;
  } catch (error) {
    console.error("Erro ao gerar nova pergunta:", error);
    throw new Error("Erro ao gerar nova pergunta.");
  }
}

app.get('/gabaritoDiscursivo', async (req, res) => {
  try {
    const novaPergunta = await fazerNovaPergunta();
    console.log(novaPergunta);

    if (typeof novaPergunta.pergunta !== 'string') {
      throw new Error('A propriedade pergunta de novaPergunta não é uma string');
    }

    let gabarito2 = [];
    const regexCorrecao = /\*\*Correção\s*:\*\*\s*([\s\S]*?)(?=\*\*Resposta|\n)/g;

    const regexResposta = /\*\*Resposta\s*:\*\*\s*([\s\S]*?)(?=\*\*Valor)/g;

    const correcaoMatches = [];
    let correcaoMatch;
    while ((correcaoMatch = regexCorrecao.exec(novaPergunta.pergunta)) !== null) {
      correcaoMatches.push(correcaoMatch);
    }

    const respostaMatches = [];
    let respostaMatch;
    while ((respostaMatch = regexResposta.exec(novaPergunta.pergunta)) !== null) {
      respostaMatches.push(respostaMatch);
    }

    if (correcaoMatches.length !== respostaMatches.length) {
      throw new Error('O número de correções e respostas não coincide.');
    }

    let notaTotal = 0;

    for (let i = 0; i < correcaoMatches.length; i++) {
      const correcao = correcaoMatches[i][1].trim();
      const respostaCerta = respostaMatches[i][1].trim();
      const numero = questoesCompletas[i].numero;
      const pergunta = questoesCompletas[i].pergunta;
      const respostaCliente = questoesCompletas[i].respostaCliente;

      let nota = 0;
      if (correcao.toLowerCase() === 'certo') {
        nota = 1;
      } else if (correcao.toLowerCase() === 'meio-certo') {
        nota = 0.5;
      } else if (correcao.toLowerCase() === 'errado') {
        nota = 0;
      }
      notaTotal += nota;

      gabarito2.push({
        numero: numero,
        pergunta: pergunta,
        correcao: correcao,
        respostaCliente: respostaCliente,
        respostaCerta: respostaCerta,
        nota: nota
      });
    }

    gabarito2.push({ notaTotal });

    console.log(gabarito2);
    res.json(gabarito2);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao gerar o gabarito');
  }
});

module.exports = app;




