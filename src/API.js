const express = require('express');
const { v4: uuidv4 } = require('uuid'); // Importe a função v4 do uuid para gerar IDs únicos
const swaggerUi = require('swagger-ui-express');
const specs = require('./swagger');
const app = express();
const port = 3000;
const opn = require('opn');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pessoas.db');
const morgan = require('morgan');

function colorize(text, colorCode) {
    return `\x1b[${colorCode}m${text}\x1b[0m`;
}

// Middleware para permitir o uso de JSON no corpo das solicitações
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.use(
    morgan((tokens, req, res) => {
        const method = tokens.method(req, res);
        const url = tokens.url(req, res);
        const status = tokens.status(req, res);
        const contentLength = tokens.res(req, res, 'content-length');
        const responseTime = tokens['response-time'](req, res);

        // Defina a cor com base no código de status (por exemplo, verde para 2xx, vermelho para 4xx, amarelo para 5xx)
        let color = '32'; // Verde (padrão para 2xx)
        if (status >= 400 && status < 500) {
            color = '31'; // Vermelho (para 4xx)
        } else if (status >= 500) {
            color = '33'; // Amarelo (para 5xx)
        }

        // Crie a mensagem formatada com a cor
        const logMessage = `${colorize(method, '1;37')} ${colorize(url, '1;36')} ${colorize(status, `1;${color}`)} ${contentLength} - ${colorize(responseTime, '1;33')} ms`;

        return logMessage;
    })
);

// Defina a estrutura da tabela (se já não estiver definida)
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS pessoas (
            id TEXT PRIMARY KEY,
            nome TEXT,
            idade INTEGER
        )
    `);
});


// Rota para cadastrar uma pessoa
/**
 * @swagger
 * /pessoa:
 *   post:
 *     summary: Cadastrar uma pessoa.
 *     tags:
 *       - Pessoas
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Nome da pessoa.
 *               idade:
 *                 type: integer
 *                 description: Idade da pessoa.
 *     responses:
 *       201:
 *         description: Pessoa cadastrada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                   description: Mensagem de sucesso.
 *                 id:
 *                   type: string
 *                   description: ID da pessoa cadastrada.
 *       400:
 *         description: Dados inválidos.
 */

app.post('/pessoa', (req, res) => {
    const { nome, idade } = req.body;
    const id = uuidv4().replace(/-/g, ''); // Gere um ID único usando o uuid

    // Verifique se o nome e a idade são válidos aqui, se necessário
    if (typeof nome !== 'string' || nome.trim() === '') {
        return res.status(400).json({ mensagem: 'O nome não pode estar em branco.' });
    }

    // Verifique se a idade é um número válido
    if (!isFinite(idade) || idade < 0) {
        return res.status(400).json({ mensagem: 'A idade deve ser um número válido.' });
    }

    // Insira os dados no banco de dados SQLite, incluindo o ID gerado
    db.run('INSERT INTO pessoas (id, nome, idade) VALUES (?, ?, ?)', [id, nome, idade], (err) => {
        if (err) {
            console.error('Erro ao inserir no banco de dados:', err);
            return res.status(500).json({ mensagem: 'Erro interno do servidor' });
        }

        res.status(201).json({ mensagem: `${nome} cadastrado(a) com sucesso!`, id: id });
    });
});

/**
 * @swagger
 * /pessoa:
 *   get:
 *     summary: Retorna todas as pessoas.
 *     tags:
 *       - Pessoas
 *     responses:
 *       200:
 *         description: Sucesso. Retorna a lista de pessoas.
 *       500:
 *         description: Erro interno do servidor.
 */
app.get('/pessoa', (req, res) => {
    // Execute uma consulta SQL para buscar todas as pessoas no banco de dados
    db.all('SELECT * FROM pessoas', (err, rows) => {
        if (err) {
            console.error('Erro ao buscar pessoas no banco de dados:', err);
            return res.status(500).json({ mensagem: 'Erro interno do servidor' });
        }

        // Envie a lista de pessoas como resposta JSON
        res.status(200).json(rows);
    });
});

// Rota para buscar informações de uma pessoa por ID

/**
 * @swagger
 * /pessoa/{id}:
 *   get:
 *     summary: Retorna uma pessoa pelo ID.
 *     tags:
 *       - Pessoas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da pessoa a ser buscada.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sucesso. Retorna os detalhes da pessoa encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: ID da pessoa.
 *                 nome:
 *                   type: string
 *                   description: Nome da pessoa.
 *                 idade:
 *                   type: integer
 *                   description: Idade da pessoa.
 *       404:
 *         description: Pessoa não encontrada.
 *       500:
 *         description: Erro interno do servidor.
 */
app.get('/pessoa/:id', (req, res) => {
    const id = req.params.id;

    // Execute uma consulta SQL para buscar uma pessoa pelo ID
    db.get('SELECT * FROM pessoas WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Erro ao buscar pessoa no banco de dados:', err);
            return res.status(500).json({ mensagem: 'Erro interno do servidor' });
        }

        // Verifique se uma pessoa foi encontrada com o ID especificado
        if (!row) {
            return res.status(404).json({ mensagem: 'Pessoa não encontrada.' });
        }

        // Envie as informações da pessoa como resposta JSON
        res.status(200).json(row);
    });
});



// Rota inicial
app.get('/', (req, res) => {
    // Leia o conteúdo do arquivo HTML
    fs.readFile('public/home.html', 'utf8', (err, data) => {
        if (err) {
            console.error('Erro ao ler o arquivo HTML:', err);
            res.status(500).send('Erro interno do servidor');
        } else {
            // Envie o conteúdo do arquivo HTML como resposta
            res.send(data);
        }
    });
});


// Rota para excluir uma pessoa por ID

/**
 * @swagger
 * /pessoa/{id}:
 *   delete:
 *     summary: Exclui uma pessoa pelo ID.
 *     tags:
 *       - Pessoas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da pessoa a ser excluída.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pessoa excluída com sucesso.
 *       404:
 *         description: Pessoa não encontrada.
 *       500:
 *         description: Erro interno do servidor.
 */
app.delete('/pessoa/:id', (req, res) => {
    const id = req.params.id;

    // Execute uma consulta SQL para excluir a pessoa com o ID especificado
    db.run('DELETE FROM pessoas WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Erro ao excluir pessoa no banco de dados:', err);
            return res.status(500).json({ mensagem: 'Erro interno do servidor' });
        }

        // Verifique se alguma linha foi afetada (se uma pessoa foi excluída)
        if (this.changes === 0) {
            return res.status(404).json({ mensagem: 'Pessoa não encontrada.' });
        }

        // Se a pessoa foi excluída com sucesso
        res.status(200).json({ mensagem: 'Pessoa excluída com sucesso.' });
    });
});

/**
 * @swagger
 * /pessoa/{id}:
 *   put:
 *     summary: Atualizar informações de uma pessoa por ID.
 *     tags:
 *       - Pessoas
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID da pessoa a ser atualizada.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Novo nome da pessoa.
 *               idade:
 *                 type: integer
 *                 description: Nova idade da pessoa.
 *     responses:
 *       200:
 *         description: Informações da pessoa atualizadas com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                   description: Mensagem de sucesso.
 *       400:
 *         description: Dados inválidos.
 *       404:
 *         description: Pessoa não encontrada.
 */
// Rota para atualizar informações de uma pessoa por ID
app.put('/pessoa/:id', (req, res) => {
    const id = req.params.id;
    const { nome, idade } = req.body;

    if (typeof nome !== 'string' || nome.trim() === '') {
        return res.status(400).json({ mensagem: 'O nome não pode estar em branco.' });
    }

    // Verifique se a idade é um número válido
    if (!isFinite(idade) || idade < 0) {
        return res.status(400).json({ mensagem: 'A idade deve ser um número válido.' });
    }


    // Execute uma consulta SQL para atualizar a pessoa com o ID especificado
    db.run('UPDATE pessoas SET nome = ?, idade = ? WHERE id = ?', [nome, idade, id], (err) => {
        if (err) {
            console.error('Erro ao atualizar pessoa no banco de dados:', err);
            return res.status(500).json({ mensagem: 'Erro interno do servidor' });
        }

        // Verifique se alguma linha foi afetada (se uma pessoa foi atualizada)
        if (this.changes === 0) {
            return res.status(404).json({ mensagem: 'Pessoa não encontrada.' });
        }

        // Se a pessoa foi atualizada com sucesso
        res.status(200).json({ mensagem: 'Informações da pessoa atualizadas com sucesso.' });
    });
});


app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}\n`);
    console.log("Desenvolvido por: Fábio Eloy Passos");

    // Abra o navegador na rota inicial
    opn('http://localhost:' + port).catch(err => {
        console.error('Erro ao abrir o navegador:', err);
    });
});
