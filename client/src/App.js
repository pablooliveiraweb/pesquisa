import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import logo from './logo.png';
import InputMask from 'react-input-mask';
import Modal from 'react-modal';

Modal.setAppElement('#root'); // Necessário para acessibilidade

function App() {
    const [nome, setNome] = useState('');
    const [cpf, setCpf] = useState('');
    const [bairro, setBairro] = useState('');
    const [telefone, setTelefone] = useState('');
    const [respostas, setRespostas] = useState([]);
    const [etapa, setEtapa] = useState(0);
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

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

    const opcoes = [
        ['Dr. Danilo', 'Ivelony', 'Tião Leal', 'Gabriel Ferrão', 'Nem Raposão'],
        ['Dr. Danilo', 'Ivelony', 'Tião Leal', 'Gabriel Ferrão', 'Nem Raposão'],
        ['Dr. Danilo', 'Ivelony', 'Tião Leal', 'Gabriel Ferrão', 'Nem Raposão'],
        ['Dr. Danilo', 'Gabriel Ferrão'],
        ['Dr. Danilo', 'Ivelony'],
        ['Ivelony', 'Gabriel Ferrão'],
        ['Sim', 'Não'],
        [] // Para a última pergunta do vereador, deixamos o array vazio para um campo de entrada de texto
    ];

    const openModal = (message) => {
        setModalMessage(message);
        setModalIsOpen(true);
    };

    const closeModal = () => {
        setModalIsOpen(false);
        setModalMessage('');
    };

    const handleVerificarCpf = async () => {
        if (!nome || !cpf || !bairro || !telefone) {
            openModal('Preencha todos os campos.');
            return;
        }
        try {
            const response = await axios.post('http://localhost:5001/api/verificar-cpf', { cpf });
            if (response.data.message === 'CPF válido.') {
                setEtapa(1);
            }
        } catch (error) {
            const message = error.response && error.response.data ? error.response.data.message : 'Erro ao verificar CPF. Tente novamente.';
            openModal(message);
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
            openModal(response.data.message);
            setNome('');
            setCpf('');
            setBairro('');
            setTelefone('');
            setRespostas([]);
            setEtapa(0);
        } catch (error) {
            console.error('Erro ao enviar voto:', error);
            const message = error.response && error.response.data ? error.response.data.message : 'Erro ao enviar voto. Tente novamente.';
            openModal(message);
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

    const downloadRelatorio = () => {
        window.open('http://localhost:5001/api/relatorio/pdf', '_blank');
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
                    <InputMask
                        mask="999.999.999-99"
                        value={cpf}
                        onChange={(e) => setCpf(e.target.value)}
                    >
                        {(inputProps) => <input {...inputProps} type="text" placeholder="CPF" />}
                    </InputMask>
                    <input type="text" placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value.toUpperCase())} />
                    <InputMask
                        mask="(99) 99999-9999"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                    >
                        {(inputProps) => <input {...inputProps} type="text" placeholder="Telefone" />}
                    </InputMask>
                    <button onClick={handleVerificarCpf}>Enviar</button>
                </div>
            ) : (
                <div className="container">
                    <h1>{perguntas[etapa - 1]}</h1>
                    <div className="options">
                        {opcoes[etapa - 1].length > 0 ? (
                            opcoes[etapa - 1].map((opcao, index) => (
                                <button key={index} onClick={() => handleNext(opcao)}>
                                    {opcao}
                                </button>
                            ))
                        ) : (
                            <div>
                                <input
                                    type="text"
                                    placeholder="Digite o nome do vereador"
                                    value={respostas[etapa - 1] || ""}
                                    onChange={(e) => setRespostas([...respostas.slice(0, etapa - 1), e.target.value.toUpperCase(), ...respostas.slice(etapa)])}
                                />
                                <button onClick={handleSubmit}>Enviar Pesquisa</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <footer className="footer">
                <p>Este é o rodapé do formulário. Coloque aqui informações adicionais.</p>
            </footer>
            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                contentLabel="Alerta"
                className="Modal"
                overlayClassName="Overlay"
            >
                <h2>Alerta</h2>
                <p>{modalMessage}</p>
                <button onClick={closeModal}>Fechar</button>
            </Modal>
        </div>
    );
}

export default App;
