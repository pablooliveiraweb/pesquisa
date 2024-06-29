const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const pdfkit = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

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
    'Considerando apenas esses candidatos disputassem as eleições hoje, qual deles você votaria para Prefeito? (Ivelony vs Gabriel Ferrão)'
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

app.get('/api/relatorio/pdf', (req, res) => {
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

        const calcularPercentualPorPergunta = (indicePergunta) => {
            const contagem = votos.reduce((acc, voto) => {
                const resposta = voto.respostas[indicePergunta];
                if (!resposta) return acc; // Skip if the answer is not defined
                if (!acc[resposta]) acc[resposta] = 0;
                acc[resposta]++;
                return acc;
            }, {});
            
            return Object.keys(contagem).map(candidato => ({
                candidato,
                percentual: ((contagem[candidato] / totalVotos) * 100).toFixed(2)
            }));
        };

        const doc = new pdfkit({ margin: 30 });

        doc.pipe(fs.createWriteStream('relatorio.pdf'));
        doc.fontSize(18).text('Relatório de Votação', { align: 'center' });
        doc.moveDown(2);

        // Total de Votos
        doc.fontSize(14).text(`Total de Votos: ${totalVotos}`, { align: 'left' });
        doc.moveDown();

        perguntas.forEach((pergunta, indice) => {
            doc.fontSize(14).text(`Pergunta ${indice + 1}: ${pergunta}`, { align: 'left' });
            doc.moveDown();
            const percentuais = calcularPercentualPorPergunta(indice);

            doc.fontSize(12);
            doc.lineWidth(0.5);
            doc.strokeColor('#000000');
            doc.lineJoin('miter').rect(30, doc.y, doc.page.width - 60, 20).stroke();
            doc.text('Candidato', 35, doc.y + 5);
            doc.text('Percentual', 150, doc.y + 5);

            percentuais.forEach(({ candidato, percentual }) => {
                if (candidato) {
                    doc.moveDown();
                    doc.lineJoin('miter').rect(30, doc.y, doc.page.width - 60, 20).stroke();
                    doc.text(candidato, 35, doc.y + 5);
                    doc.text(`${percentual}%`, 150, doc.y + 5);
                }
            });

            doc.moveDown(2);
        });

        doc.end();

        res.setHeader('Content-disposition', 'attachment; filename=relatorio.pdf');
        res.setHeader('Content-type', 'application/pdf');

        const filestream = fs.createReadStream('relatorio.pdf');
        filestream.pipe(res);
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
