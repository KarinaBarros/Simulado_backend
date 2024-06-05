const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000; 
const nodemailer = require('nodemailer');
const simuladoApp = require('./simulado.js');
const rateLimit = require('express-rate-limit');





const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // limite de 10 requisições
  message: 'Limite de requisições excedido, por favor, tente novamente mais tarde.'
})

app.use((err, req, res, next) => {
  if (err instanceof rateLimit.RateLimitError) {
    res.status(429).send('Limite de requisições excedido, por favor, tente novamente mais tarde, se esqueceu sua senha altere a senha ou faça um novo cadastro.');
  } else {
    next(err);
  }
})

function removeRateLimit(req, res, next) {
  // Removendo o limite de taxa para a rota /trocar-senha
  limiter.resetKey(req.ip);
  next();
}

// Configuração do serviço de e-mail
const transporter = nodemailer.createTransport({
  service: 'hotmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// Conexão com o banco de dados
async function connectDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE
    });
    console.log('Conexão bem-sucedida ao banco de dados MySQL na AWS');
    return connection;
  } catch (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    throw err; 
  }
}

// Rota para cadastrar um novo usuário
app.post('/register', async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const connection = await connectDB();

    const [existingUsers] = await connection.query('SELECT * FROM login_simulado WHERE email = ?', [email]);

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Este email já está em uso' });
    }

    const tokenData = { nome, email, senha };
    const token = jwt.sign(tokenData, 'emailconfirmationtoken', { expiresIn: '10m' });

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Confirme seu registro',
      text: `Por favor, clique no link a seguir para confirmar seu registro: ${process.env.FRONT_LOCATION}/confirm/${token}`,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: 'Por favor, verifique seu e-mail para confirmar o registro' });
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
});

// Rota para confirmar o registro
app.post('/confirm',  async (req, res) => {
  const { token } = req.body; 

  if (!token) {
    return res.status(400).json({ error: 'Token de confirmação ausente' });
  }

  try {
    const decoded = jwt.verify(token, 'emailconfirmationtoken');
    const { nome, senha, email } = decoded; 
    
    const hashedPassword = await bcrypt.hash(senha, 10);
    const connection = await connectDB();
    await connection.query('INSERT INTO login_simulado (nome, email, senha) VALUES (?, ?, ?)', [nome, email, hashedPassword]);
    removeRateLimit(req, res, () => {});
    res.status(201).json({ message: 'Registro confirmado com sucesso' });
  } catch (error) {
    console.error('Erro ao confirmar registro:', error);
    res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
});




// Rota para autenticar o usuário
app.post('/login',limiter, async (req, res) => {
    const { email, senha } = req.body;

    try {
        const connection = await connectDB();

        const [rows] = await connection.query('SELECT * FROM login_simulado WHERE email = ?', [email]);
        const user = rows[0];

        if (!user) {
            console.log('Usuário não encontrado');
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const passwordMatch = await bcrypt.compare(senha, user.senha);

        if (!passwordMatch) {
            console.log('Credenciais inválidas');
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign({ userId: user.id }, 'secretpassword', { expiresIn: '30d' });
        removeRateLimit(req, res, () => {});
        res.json({ 
          token: jwt.sign({ userId: user.id }, 'secretpassword', { expiresIn: '30d' }),
          nome: user.nome 
        });
    } catch (error) {
        console.error('Erro ao autenticar usuário:', error);
        res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }

    
});

// Rota para solicitar troca de senha
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const connection = await connectDB();

    const [rows] = await connection.query('SELECT * FROM login_simulado WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const tokenData = { userId: user.id };
    const token = jwt.sign(tokenData, 'emailconfirmationtoken', { expiresIn: '10m' });

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Troca de senha',
      text: `Clique no link a seguir para redefinir sua senha: ${process.env.FRONT_LOCATION}/reset-password/${token}`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Um e-mail foi enviado com instruções para redefinir sua senha' });
  } catch (error) {
    console.error('Erro ao solicitar troca de senha:', error);
    res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
});

// Rota para confirmar troca de senha
app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token de redefinição de senha ou nova senha ausente' });
  }

  try {
    const decoded = jwt.verify(token, 'emailconfirmationtoken');
    const { userId } = decoded;
  
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const connection = await connectDB();
    await connection.query('UPDATE login_simulado SET senha = ? WHERE id = ?', [hashedPassword, userId]);
    removeRateLimit(req, res, () => {});
    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
  
});


// Middleware para proteger rotas privadas
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.sendStatus(401);
  }

  jwt.verify(token, 'secretpassword', (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

app.use(authenticateToken, simuladoApp);

// Rota protegida
app.get('/protected', authenticateToken, (req, res) => {
  res.json(req.user);
});

// Inicialização do servidor
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Servidor está rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
}

startServer();
