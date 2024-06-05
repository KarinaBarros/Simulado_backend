const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const app = express();


require('dotenv').config();
app.use(express.json());


let storedData;
let respostas;
let formattedData;
let dados;

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

function formatarQuestoes(texto) {
  const linhas = texto.split("\n");
  let questoes = [];
  let questaoAtual = null;

  linhas.forEach(linha => {
    if (linha.startsWith("**Questão")) {
      if (questaoAtual) {
        if (!questaoAtual.pergunta || questaoAtual.opcoes.length !== 5 || !questaoAtual.resposta || !questaoAtual.explicacao) {
          throw new Error("A questão não atende aos critérios: cada questão deve ter uma pergunta, cinco opções, uma resposta e uma explicação.");
        }
        questoes.push(questaoAtual);
      }
        questaoAtual = {
        pergunta: "",
        opcoes: [],
        resposta: "",
        explicacao: ""
      };
      questaoAtual.numero = parseInt(linha.match(/\d+/)[0]);
    } else if (linha.startsWith("(")) {
      questaoAtual.opcoes.push(linha);
    } else if (linha.startsWith("**Resposta")) {
      questaoAtual.resposta = linha;
    } else if (linha.startsWith("**Explicação")) {
      questaoAtual.explicacao = linha;
    } else if (questaoAtual) {
      questaoAtual.pergunta += linha + '\n';
    }
  });

  if (questaoAtual) {
    if (!questaoAtual.pergunta || questaoAtual.opcoes.length !== 5 || !questaoAtual.resposta || !questaoAtual.explicacao) {
      throw new Error("A questão não atende aos critérios: cada questão deve ter uma pergunta, cinco opções, uma resposta e uma explicação.");
    }
    questoes.push(questaoAtual);
  }
  if (questoes.length !== 10) {
    throw new Error("Não foram retornadas exatamente 10 questões.");
  }
  return questoes;
}


async function getMessage(tema, nivel) {
  return `Elabore questões de 1 a 10 com alternativas a b c d e, bem distribuídas e com a resposta em baixo de cada questão para o tema ${tema} para o ${nivel}, em baixo de cada resposta me explique porque aquela resposta é a correta. me envie em um formato questao contendo a questao, opções (a) (b) (c) (d) (e) contendo as opções, resposta contendo a resposta, explicação contendo a esplicação `;
}

async function run(tema, nivel) {

  
  console.log(tema, nivel);
  const generationConfig = {
    temperature: 0.7,
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
  const model = genAI.getGenerativeModel({ model: "gemini-pro", generationConfig, safetySettings});
  const prompt = await getMessage(tema, nivel);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const questoesFormatadas = formatarQuestoes(response.text());
  storedData = questoesFormatadas;
  return questoesFormatadas;
}

app.post('/api', async (req, res) => {
  try {
    const { tema, nivel } = req.body;
    const data = await run(tema, nivel);
    formattedData = data.map(questao => ({
      numero: questao.numero,
      pergunta: questao.pergunta,
      opcoes: questao.opcoes,
    }));
    
    res.json(formattedData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating response');
  }
});

app.get('/simulado', (req, res) => {
  // Verifique se há respostas armazenadas
  if (!formattedData) {
    return res.status(404).json({ error: 'Gabarito não encontrado' });
  }
  
  // Envie o gabarito como resposta
  res.json(formattedData);
});

app.post('/respostas', (req, res) => {
  
  const respostasUsuario = req.body;
  const letrasRespostasUsuario = respostasUsuario.map(resposta => {
    const match = resposta.match(/\((\w)\)/);
    return match ? match[1] : null;
  });

  
  const correcao = [];
  const notas = [];
  

    respostas = storedData.map((questao, index) => {
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
 

  const letrasRespostas = storedData.map(questao => {
    const match = questao.resposta.match(/\((\w)\)/);
    return match ? match[1] : null;
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

  dados = {
    nota: nota,
    respostas: respostas
  }
  
  res.json(respostas);
 
});

app.get('/gabarito', (req, res) => {
  // Verifique se há respostas armazenadas
  if (!respostas) {
    return res.status(404).json({ error: 'Gabarito não encontrado' });
  }

  
  
  // Envie o gabarito como resposta
  res.json(dados);
});


module.exports = app;
