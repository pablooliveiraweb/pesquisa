const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const pdfkit = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const puppeteer = require('puppeteer');

// Configuração do banco de dados SQLite
const db = new sqlite3.Database('./votos.db');
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS votos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, cpf TEXT, bairro TEXT, telefone TEXT, respostas TEXT)");
});

const app = express();

// Definição das perguntas
const perguntas = [
    'Se as eleições municipais fossem hoje em quem você votaria para Prefeito?',
    'Se as eleições municipais fossem hoje em quem você NÃO votaria de jeito nenhum para Prefeito?',
    'Se as eleições Municipais fossem hoje qual seria a sua segunda opção de voto, caso o seu candidato não participasse?',
    'Considerando apenas esses candidatos disputassem as eleições hoje, qual deles você votaria para Prefeito? (Dr. Danilo vs Gabriel Ferrão)',
    'Considerando apenas esses candidatos disputassem as eleições hoje, qual deles você votaria para Prefeito? (Dr. Danilo vs Ivelony)',
    'Considerando apenas esses candidatos disputassem as eleições hoje, qual deles você votaria para Prefeito? (Ivelony vs Gabriel Ferrão)',
    'Da data de hoje até o dia das eleições o seu voto pode mudar?',
    'Se as eleições Municipais fossem hoje em quem você votaria para vereador?'
];

// Configurar CORS para permitir requisições de http://localhost:3000
app.use(cors({
    origin: 'http://localhost:3000'
}));

app.use(bodyParser.json());

// Configurar para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/verificar-cpf', (req, res) => {
    const { cpf } = req.body;

    db.get("SELECT * FROM votos WHERE cpf = ?", [cpf], (err, row) => {
        if (row) {
            return res.status(400).json({ message: 'Este CPF já foi utilizado.' });
        } else {
            return res.status(200).json({ message: 'CPF válido.' });
        }
    });
});

app.post('/api/votar', (req, res) => {
    const { nome, cpf, bairro, telefone, respostas } = req.body;

    if (!nome || !cpf || !bairro || !telefone || !respostas) {
        console.error('Dados incompletos recebidos:', req.body);
        return res.status(400).json({ message: 'Preencha todos os campos.' });
    }

    db.get("SELECT * FROM votos WHERE cpf = ?", [cpf], (err, row) => {
        if (row) {
            console.error('CPF duplicado:', cpf);
            return res.status(400).json({ message: 'Este CPF já foi utilizado.' });
        }

        const stmt = db.prepare("INSERT INTO votos (nome, cpf, bairro, telefone, respostas) VALUES (?, ?, ?, ?, ?)");
        stmt.run(nome, cpf, bairro, telefone, JSON.stringify(respostas), (err) => {
            if (err) {
                console.error('Erro ao salvar voto:', err);
                return res.status(500).json({ message: 'Erro ao salvar voto. Tente novamente.' });
            }
            stmt.finalize();
            res.status(201).json({ message: 'Voto registrado com sucesso!' });
        });
    });
});

app.get('/api/relatorio', (req, res) => {
    db.all("SELECT * FROM votos", [], (err, rows) => {
        if (err) {
            console.error('Erro ao gerar relatório:', err);
            return res.status(500).json({ message: 'Erro ao gerar relatório.' });
        }
        const votos = rows.map(row => ({
            ...row,
            respostas: JSON.parse(row.respostas)
        }));
        const totalVotos = votos.length;

        const contagem = votos.reduce((acc, voto) => {
            voto.respostas.forEach((resposta, index) => {
                if (!acc[index]) acc[index] = {};
                if (!resposta) return;
                if (!acc[index][resposta]) acc[index][resposta] = 0;
                acc[index][resposta]++;
            });
            return acc;
        }, []);

        const percentuais = contagem.map(pergunta => {
            return Object.keys(pergunta).map(candidato => ({
                candidato,
                percentual: ((pergunta[candidato] / totalVotos) * 100).toFixed(2)
            }));
        });

        const votosPorBairro = votos.reduce((acc, voto) => {
            const bairro = voto.bairro;
            const cpf = voto.cpf;
            if (!acc[bairro]) acc[bairro] = { total: 0, cpfs: new Set(), votos: {} };
            if (!acc[bairro].cpfs.has(cpf)) {
                acc[bairro].cpfs.add(cpf);
                acc[bairro].total++;
            }
            voto.respostas.forEach((resposta, index) => {
                if (!acc[bairro].votos[index]) acc[bairro].votos[index] = {};
                if (!resposta) return;
                if (!acc[bairro].votos[index][resposta]) acc[bairro].votos[index][resposta] = 0;
                acc[bairro].votos[index][resposta]++;
            });
            return acc;
        }, {});

        const totalVotosPorBairro = Object.keys(votosPorBairro).map(bairro => ({
            bairro,
            total: votosPorBairro[bairro].total,
            votos: votosPorBairro[bairro].votos
        }));

        const relatorioPorPergunta = perguntas.map((pergunta, indice) => {
            const contagemPorPergunta = votos.reduce((acc, voto) => {
                const resposta = voto.respostas[indice];
                if (!resposta) return acc;
                if (!acc[resposta]) acc[resposta] = 0;
                acc[resposta]++;
                return acc;
            }, {});
            const percentuaisPorPergunta = Object.keys(contagemPorPergunta).map(candidato => ({
                candidato,
                percentual: ((contagemPorPergunta[candidato] / totalVotos) * 100).toFixed(2)
            }));
            return { pergunta, percentuaisPorPergunta };
        });

        res.json({ totalVotos, percentuais, votosPorBairro: totalVotosPorBairro, relatorioPorPergunta });
    });
});

app.get('/api/relatorio/pdf', async (req, res) => {
    db.all("SELECT * FROM votos", [], async (err, rows) => {
        if (err) {
            console.error('Erro ao gerar relatório:', err);
            return res.status(500).json({ message: 'Erro ao gerar relatório.' });
        }

        const votos = rows.map(row => ({
            ...row,
            respostas: JSON.parse(row.respostas)
        }));

        const totalVotos = votos.length;

        const calcularPercentualPorPergunta = (indicePergunta) => {
            const contagem = votos.reduce((acc, voto) => {
                const resposta = voto.respostas[indicePergunta];
                if (!resposta) return acc;
                if (!acc[resposta]) acc[resposta] = 0;
                acc[resposta]++;
                return acc;
            }, {});

            return Object.keys(contagem).map(candidato => ({
                candidato,
                percentual: ((contagem[candidato] / totalVotos) * 100).toFixed(2)
            }));
        };

        // Carregar dados para o HTML
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Relatório de Votação</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; background-color: #f7f7f7; }
                    .container { margin-top: 50px; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); width: 80%; max-width: 800px; }
                    h1 { font-size: 24px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                    th { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Relatório de Votação</h1>
                    <h2>Total de Votos: ${totalVotos}</h2>
                    ${perguntas.map((pergunta, indice) => `
                        <h2>Pergunta ${indice + 1}: ${pergunta}</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Candidato</th>
                                    <th>Percentual</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${calcularPercentualPorPergunta(indice).map(({ candidato, percentual }) => `
                                    <tr>
                                        <td>${candidato}</td>
                                        <td>${percentual}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `).join('')}
                </div>
            </body>
            </html>
        `;

        // Usar puppeteer para gerar o PDF a partir do HTML
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
        });

        await browser.close();

        res.setHeader('Content-disposition', 'attachment; filename=relatorio.pdf');
        res.setHeader('Content-type', 'application/pdf');
        res.send(pdf);
    });
});

// Endpoint para servir a página de relatório
app.get('/relatorio', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'relatorio.html'));
});

// Endpoint para resetar o banco de dados
app.post('/api/reset-db', (req, res) => {
    db.serialize(() => {
        db.run("DROP TABLE IF EXISTS votos");
        db.run("CREATE TABLE votos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, cpf TEXT, bairro TEXT, telefone TEXT, respostas TEXT)");
    });
    res.json({ message: 'Banco de dados resetado com sucesso.' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
