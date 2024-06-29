import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import logo from './logo.png'; // Certifique-se de que este caminho está correto

function App() {
    const [nome, setNome] = useState('');
    const [cpf, setCpf] = useState('');
    const [bairro, setBairro] = useState('');
    const [telefone, setTelefone] = useState('');
    const [respostas, setRespostas] = useState([]);
    const [etapa, setEtapa] = useState(0);

    const perguntas = [
        'Se as eleições municipais fossem hoje em quem você votaria para Prefeito?',
        'Se as eleições municipais fossem hoje em quem você NÃO votaria de jeito nenhum para Prefeito?',
        'Se as eleições Municipais fossem hoje qual seria a sua segunda opção de voto, caso o seu candidato não participasse?',
        'Considerando apenas esses candidatos disputassem as eleições hoje, qual deles você votaria para Prefeito? (Dr. Danilo vs Gabriel Ferrão)',
        'Considerando apenas esses candidatos disputassem as eleições hoje, qual deles você votaria para Prefeito? (Dr. Danilo vs Ivelony)',
        'Considerando apenas esses candidatos disputassem as eleições hoje, qual deles você votaria para Prefeito? (Ivelony vs Gabriel Ferrão)'
    ];

    const opcoes = [
        ['Dr. Danilo', 'Ivelony', 'Tião Leal', 'Gabriel Ferrão', 'Nem Raposão'],
        ['Dr. Danilo', 'Ivelony', 'Tião Leal', 'Gabriel Ferrão', 'Nem Raposão'],
        ['Dr. Danilo', 'Ivelony', 'Tião Leal', 'Gabriel Ferrão', 'Nem Raposão'],
        ['Dr. Danilo', 'Gabriel Ferrão'],
        ['Dr. Danilo', 'Ivelony'],
        ['Ivelony', 'Gabriel Ferrão']
    ];

    const handleVerificarCpf = async () => {
        try {
            const response = await axios.post('http://localhost:5001/api/verificar-cpf', { cpf });
            if (response.data.message === 'CPF válido.') {
                setEtapa(1);
            }
        } catch (error) {
            const message = error.response && error.response.data ? error.response.data.message : 'Erro ao verificar CPF. Tente novamente.';
            alert(message);
        }
    };

    const handleSubmit = async () => {
        try {
            const response = await axios.post('http://localhost:5001/api/votar', {
                nome,
                cpf,
                bairro,
                telefone,
                respostas
            });
            alert(response.data.message);
            setNome('');
            setCpf('');
            setBairro('');
            setTelefone('');
            setRespostas([]);
            setEtapa(0);
        } catch (error) {
            console.error('Erro ao enviar voto:', error);
            const message = error.response && error.response.data ? error.response.data.message : 'Erro ao enviar voto. Tente novamente.';
            alert(message);
        }
    };

    const handleNext = (resposta) => {
        setRespostas([...respostas, resposta]);
        if (etapa === perguntas.length) {
            handleSubmit();
        } else {
            setEtapa(etapa + 1);
        }
    };

    return (
        <div className="App">
            <header className="header">
                <img src={logo} alt="Logo" className="logo" />
            </header>
            {etapa === 0 ? (
                <div className="container">
                    <h1>Cadastro</h1>
                    <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} />
                    <input type="text" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
                    <input type="text" placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value.toUpperCase())} />
                    <input type="text" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                    <button onClick={handleVerificarCpf}>Enviar</button>
                </div>
            ) : (
                <div className="container">
                    <h1>{perguntas[etapa - 1]}</h1>
                    <div className="options">
                        {opcoes[etapa - 1].map((opcao, index) => (
                            <button key={index} onClick={() => handleNext(opcao)}>
                                {opcao}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <footer className="footer">
                <p>Este é o rodapé do formulário. Coloque aqui informações adicionais.</p>
            </footer>
        </div>
    );
}

export default App;
