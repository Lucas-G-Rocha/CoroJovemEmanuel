const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const { MongoClient } = require('mongodb');

// URL de conexão para o MongoDB (ajuste para sua configuração)
const uri = "mongodb+srv://admin:oZWjjkCsYF3ld7HN@cluster0.gdt4c.mongodb.net/CoroJovemEmanuel?retryWrites=true&w=majority&appName=Cluster0";
const dbName = 'CoroJovemEmanuel';

const app = express();
let client;

async function conectarAoBanco() {
  if (!client) {
    client = new MongoClient(uri); // Adicione opções para evitar avisos
    await client.connect();
    console.log('Conectado ao MongoDB!');
  }
  return client.db(dbName);
}





// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));
// Caminho do arquivo JSON
app.use(express.urlencoded({ extended: true }));

// Função para ler o arquivo JSON
const readData = async () => {
    const db = await conectarAoBanco();
    const colecaoMusicas = db.collection('musicas');
    
    // Lê o primeiro documento que contém músicas e o admin
    const documento = await colecaoMusicas.findOne({}); // Lê um único documento

    // Se o documento existir, armazena os dados em uma variável
    const data = {
        musicas: documento ? documento.musicas : [], // Se o documento não existir, retorna um array vazio
        admin: documento ? documento.admin : null // Se o documento não existir, retorna null
    };
    
    return data; // Retorna a variável com os dados
};
  



// Configuração da sessão
app.use(session({
  secret: 'seuSegredoSeguro', // Um segredo seguro para assinar a sessão
  resave: false, // Não salvar se não houver modificações
  saveUninitialized: false, // Não salvar sessões vazias
  cookie: { secure: false } // Em desenvolvimento, o `secure` deve ser `false`. Em produção, use `true` para HTTPS.
}));


// Função para escrever no arquivo JSON
const writeData = async (data) => {
    const db = await conectarAoBanco();
    
    // Referência à coleção
    const colecaoMusicas = db.collection('musicas');
    
    // Verifica se já existe um documento na coleção
    const documentoExistente = await colecaoMusicas.findOne({});

    if (documentoExistente) {
        // Se já existe, atualiza apenas o campo "musicas"
        await colecaoMusicas.updateOne(
            {},
            { $set: { musicas: data.musicas } }
        );
    } else {
        // Se não existe, insere um novo documento com o campo "musicas"
        const documentoParaInserir = {
            musicas: data.musicas,
            admin: data.admin // Supondo que data.admin já está no formato correto
        };

        await colecaoMusicas.insertOne(documentoParaInserir);
    }
};




function isAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) {
        return next(); // Se autenticado, prossegue para a próxima função
    } else {
        res.status(401).send('Você precisa estar logado para acessar essa funcionalidade.');
    }
}


//Enviando arquivos HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/html/index.html'));

});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/html/login.html'));
});
app.get('/musica/:titulo', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/html/musica.html'));
});


app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body;
    
    
    const dados = await readData();
    
    if (!dados) {
        console.error('Falha ao ler os dados do arquivo.');
        return res.status(500).send('Erro interno do servidor.');
    }

    const admin = dados.admin;

    if (admin.usuario === usuario && admin.senha === senha) {
        req.session.isAuthenticated = true; // Armazena na sessão que o usuário está autenticado
        req.session.user = usuario; // Armazena informações do usuário
        
        res.redirect('/');
    } else {
       
        res.status(401).send('Usuário ou senha incorretos!');
    }
});

app.get('/adicionarMusica', isAuthenticated, (req, res) =>{
    res.sendFile(path.join(__dirname, '../views/adicionarMusica.html'));

});
app.get('/editarMusica/:titulo', isAuthenticated, (req, res) =>{
    res.sendFile(path.join(__dirname, '../views/editarMusica.html'));
});


app.get('/api/musica/:titulo', async (req, res) => {
    const { titulo } = req.params;
    const data = await readData();
    
    const index = data.musicas.findIndex(m => m.titulo === titulo);
    if (index !== -1) {
        
        res.json(data.musicas[index]);
    } else {
        res.status(404).json({ message: 'Música não encontrada' });
    }
});

// Rota para obter todas as músicas
app.get('/api/musicas', async (req, res) => {
    const data = await readData();
    res.json(data.musicas);
});

// Rota para adicionar uma nova música
app.post('/api/adicionarMusica', isAuthenticated,  async (req, res) => {
    // Extraindo os dados do formulário do req.body
    const { titulo, autor, youtubeLink, conteudo } = req.body;

    // Criando um novo objeto de música
    const newMusic = {
        titulo: titulo.toLowerCase(), // Convertendo o título para minúsculas
        autor: autor.toLowerCase(),   // Convertendo o autor para minúsculas
        youtubeLink: youtubeLink,
        conteudo: conteudo,
        solistas: [], // Inicializando como um array vazio
        isSelected: 0
    };

    // Lendo os dados existentes
    const data = await readData();

    // Adicionando a nova música ao array de músicas
    data.musicas.push(newMusic);

    // Salvando os dados de volta ao arquivo JSON
    await writeData(data);

    // Respondendo ao cliente
    res.redirect('/musica/' + encodeURIComponent(newMusic.titulo)); // Retorna a nova música criada
});


// Rota para atualizar uma música
app.post('/api/editarMusica/:titulo', isAuthenticated, async (req, res) => {
    let { titulo } = req.params;
    titulo = titulo.toLowerCase(); // Convertendo o título do parâmetro para minúsculas

    const data = await readData();
    const index = data.musicas.findIndex(m => m.titulo === titulo);

    if (index !== -1) {
        // Crie um novo objeto de música atualizado, atribuindo manualmente os campos
        const updatedMusic = {
            titulo: req.body.titulo.toLowerCase(), // Convertendo o título para minúsculas
            autor: req.body.autor.toLowerCase(),   // Convertendo o autor para minúsculas
            youtubeLink: req.body.youtubeLink,
            conteudo: req.body.conteudo,
            isSelected: 0,
            solistas: []
        };

        data.musicas[index] = updatedMusic; // Atualiza a música existente com os novos dados
        await writeData(data); // Salva as alterações no arquivo
        res.redirect('/musica/' + encodeURIComponent(updatedMusic.titulo)); // Redireciona para a página da música editada
    } else {
        res.status(404).json({ message: 'Música não encontrada' });
    }
});

app.patch('/api/musicas/:titulo/isSelected', isAuthenticated, async (req, res) => {
    const { titulo } = req.params;
    const { isSelected } = req.body; // Espera receber o novo valor de isSelected no corpo da requisição
    const data = await readData();

    const index = data.musicas.findIndex(m => m.titulo === titulo);
    if (index !== -1) {
        // Atualiza apenas o isSelected
        data.musicas[index].isSelected = isSelected;
        await writeData(data);
        res.json({ status: 'success', data: { titulo, isSelected } });
    } else {
        res.status(404).json({ status: 'error', message: 'Música não encontrada' });
    }
});

app.patch('/api/musicas/:titulo/solistas', isAuthenticated, async (req, res) => {
    const { titulo } = req.params;
    const { NovoConteudo, tipo} = req.body;
    const data = await readData();
    
    const musicaIndex = data.musicas.findIndex(m => m.titulo === titulo);

    if (musicaIndex !== -1) {
        // Atualiza o conteúdo da música inteira
        data.musicas[musicaIndex].conteudo = NovoConteudo;
        
    
        if (Array.isArray(tipo)) {
            if (tipo[0].startsWith('remove')) {
                const nomesASeremRemovidosArray = tipo[1].split(',').map(nome => nome.trim()); // Transforma em array
    
                // Para cada nome a ser removido, verificar se ele está no conteúdo
                nomesASeremRemovidosArray.forEach(nomeASerRemovido => {
                    const regexGlobal = /&lt;-&gt;#(.*?)&lt;-&gt;/g; // Regex para pegar todas as chaves presentes no conteúdo
                    let match;
                    let solistaPresente = false;
    
                    // Enquanto encontrar correspondências no conteúdo
                    while ((match = regexGlobal.exec(NovoConteudo)) !== null) {
                        const solistasEncontrados = match[1].split(',').map(nome => nome.trim()); // Extrai os solistas entre as chaves e transforma em array se houver vírgula
    
                        // Se o solista atual a ser removido está entre os solistas encontrados, ele não pode ser removido
                        if (solistasEncontrados.includes(nomeASerRemovido)) {
                            solistaPresente = true;
                            
                            break; // Pode parar de verificar pois já sabemos que ele está presente
                        }
                    }
    
                    // Se o solista não está presente em nenhum lugar do conteúdo, ele pode ser removido
                    if (!solistaPresente) {
                        data.musicas[musicaIndex].solistas = data.musicas[musicaIndex].solistas.filter(
                            (s) => s !== nomeASerRemovido
                        );
                        
                    }
                });
            } else {
                // Para adicionar os solistas
                tipo.forEach((t) => {
                    if (!data.musicas[musicaIndex].solistas.includes(t)) {
                        data.musicas[musicaIndex].solistas.push(t);
                    }
                });
            }
        } else {
            // Adiciona um solista
            if (!data.musicas[musicaIndex].solistas.includes(tipo)) {
                data.musicas[musicaIndex].solistas.push(tipo);
            }
        }
    
        await writeData(data);
        res.json({ message: 'Conteúdo atualizado com sucesso.' });
    } else {
        res.status(404).json({ message: 'Música não encontrada' });
    }
    
});



// Rota para deletar uma música
app.delete('/api/musicas/:titulo', isAuthenticated, async (req, res) => {
    let { titulo } = req.params;
    titulo = titulo.toLowerCase(); // Convertendo o título do parâmetro para minúsculas

    const data = await readData();
    const index = data.musicas.findIndex(m => m.titulo === titulo);

    if (index !== -1) {
        const deletedMusic = data.musicas.splice(index, 1);
        await writeData(data);
        res.json(deletedMusic);
    } else {
        res.status(404).json({ message: 'Música não encontrada' });
    }
});

app.get('/api/verificarSessao', (req, res) => {
    if (req.session.isAuthenticated) {
        res.json({ logado: true, usuario: req.session.user });
    } else {
        res.json({ logado: false });
    }
});


app.get('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Erro ao encerrar sessão.');
        }
        res.redirect('/');
    });
});


// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});






