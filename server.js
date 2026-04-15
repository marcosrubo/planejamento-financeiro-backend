const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// LOGS DE DIAGNÓSTICO
console.log('----------------------------------------');
console.log('Inicializando servidor...');
console.log('PORT:', PORT);
console.log('SUPABASE_URL carregada:', JSON.stringify(supabaseUrl));
console.log('SUPABASE_KEY existe?', !!supabaseKey);
console.log('----------------------------------------');

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: defina SUPABASE_URL e SUPABASE_KEY nas variáveis de ambiente.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =========================
// FUNÇÕES AUXILIARES
// =========================

function normalizarNome(nome) {
  return String(nome || '').trim();
}

function validarNivel(nivel) {
  return [1, 2, 3].includes(Number(nivel));
}

function logErroSupabase(contexto, error) {
  console.error(`Erro em ${contexto}:`, {
    message: error?.message || null,
    details: error?.details || null,
    hint: error?.hint || null,
    code: error?.code || null,
    fullError: error || null
  });
}

async function buscarCategoriaPorId(id) {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    logErroSupabase(`buscarCategoriaPorId(${id})`, error);
    return null;
  }

  return data;
}

async function validarHierarquia({ nome, nivel, parent_id, idAtual = null }) {
  const nomeTratado = normalizarNome(nome);
  const nivelNumero = Number(nivel);
  const parentIdNumero =
    parent_id === null || parent_id === undefined || parent_id === ''
      ? null
      : Number(parent_id);

  if (!nomeTratado) {
    return { ok: false, status: 400, message: 'O nome é obrigatório.' };
  }

  if (!validarNivel(nivelNumero)) {
    return { ok: false, status: 400, message: 'O nível deve ser 1, 2 ou 3.' };
  }

  if (parentIdNumero !== null && (!Number.isInteger(parentIdNumero) || parentIdNumero <= 0)) {
    return { ok: false, status: 400, message: 'parent_id inválido.' };
  }

  if (idAtual !== null && parentIdNumero === Number(idAtual)) {
    return { ok: false, status: 400, message: 'Um registro não pode ser pai dele mesmo.' };
  }

  if (nivelNumero === 1) {
    if (parentIdNumero !== null) {
      return {
        ok: false,
        status: 400,
        message: 'Registro de nível 1 (Grupo) não pode ter categoria pai.'
      };
    }
  }

  if (nivelNumero === 2) {
    if (parentIdNumero === null) {
      return {
        ok: false,
        status: 400,
        message: 'Registro de nível 2 (Subgrupo) deve ter um Grupo como pai.'
      };
    }

    const pai = await buscarCategoriaPorId(parentIdNumero);

    if (!pai) {
      return { ok: false, status: 400, message: 'Categoria pai não encontrada.' };
    }

    if (Number(pai.nivel) !== 1) {
      return {
        ok: false,
        status: 400,
        message: 'Subgrupo só pode ter pai de nível 1 (Grupo).'
      };
    }
  }

  if (nivelNumero === 3) {
    if (parentIdNumero === null) {
      return {
        ok: false,
        status: 400,
        message: 'Registro de nível 3 (Categoria) deve ter um Subgrupo como pai.'
      };
    }

    const pai = await buscarCategoriaPorId(parentIdNumero);

    if (!pai) {
      return { ok: false, status: 400, message: 'Categoria pai não encontrada.' };
    }

    if (Number(pai.nivel) !== 2) {
      return {
        ok: false,
        status: 400,
        message: 'Categoria de nível 3 só pode ter pai de nível 2 (Subgrupo).'
      };
    }
  }

  return {
    ok: true,
    payload: {
      nome: nomeTratado,
      nivel: nivelNumero,
      parent_id: parentIdNumero
    }
  };
}

// =========================
// ROTA INICIAL
// =========================

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>API RuboWeb</title>
      </head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>API RuboWeb 🚀</h1>
        <p>CRUD de categorias funcionando.</p>
        <p>Servidor no ar.</p>
      </body>
    </html>
  `);
});

// =========================
// GET /categorias
// =========================

app.get('/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nivel', { ascending: true })
      .order('nome', { ascending: true });

    if (error) {
      logErroSupabase('GET /categorias', error);
      return res.status(500).json({ error: 'Erro ao buscar categorias.' });
    }

    res.json(data);
  } catch (err) {
    console.error('Erro interno em GET /categorias:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// =========================
// GET /categorias/:id
// =========================

app.get('/categorias/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      if (error) logErroSupabase(`GET /categorias/${id}`, error);
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }

    res.json(data);
  } catch (err) {
    console.error(`Erro interno em GET /categorias/${req.params.id}:`, err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// =========================
// POST /categorias
// =========================

app.post('/categorias', async (req, res) => {
  try {
    const { nome, nivel, parent_id } = req.body;

    const validacao = await validarHierarquia({ nome, nivel, parent_id });

    if (!validacao.ok) {
      return res.status(validacao.status).json({ error: validacao.message });
    }

    const { data, error } = await supabase
      .from('categorias')
      .insert([validacao.payload])
      .select()
      .single();

    if (error) {
      logErroSupabase('POST /categorias', error);

      if (error.message && error.message.toLowerCase().includes('uq_categorias_nome_parent')) {
        return res.status(400).json({
          error: 'Já existe uma categoria com esse nome dentro do mesmo grupo pai.'
        });
      }

      return res.status(500).json({ error: 'Erro ao cadastrar categoria.' });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Erro interno em POST /categorias:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// =========================
// PUT /categorias/:id
// =========================

app.put('/categorias/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const existente = await buscarCategoriaPorId(id);

    if (!existente) {
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }

    const { nome, nivel, parent_id } = req.body;

    const validacao = await validarHierarquia({
      nome,
      nivel,
      parent_id,
      idAtual: id
    });

    if (!validacao.ok) {
      return res.status(validacao.status).json({ error: validacao.message });
    }

    const { data: filhos, error: erroFilhos } = await supabase
      .from('categorias')
      .select('id, nivel')
      .eq('parent_id', id);

    if (erroFilhos) {
      logErroSupabase(`PUT /categorias/${id} - verificar filhos`, erroFilhos);
      return res.status(500).json({ error: 'Erro ao verificar filhos da categoria.' });
    }

    const novoNivel = validacao.payload.nivel;

    if (filhos && filhos.length > 0) {
      if (novoNivel === 3) {
        return res.status(400).json({
          error: 'Categoria de nível 3 não pode ter filhos.'
        });
      }

      const filhosEsperados = novoNivel + 1;
      const algumFilhoInvalido = filhos.some(filho => Number(filho.nivel) !== filhosEsperados);

      if (algumFilhoInvalido) {
        return res.status(400).json({
          error: 'A alteração de nível deixaria a hierarquia inconsistente com os filhos existentes.'
        });
      }
    }

    const { data, error } = await supabase
      .from('categorias')
      .update(validacao.payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logErroSupabase(`PUT /categorias/${id}`, error);
      return res.status(500).json({ error: 'Erro ao atualizar categoria.' });
    }

    res.json(data);
  } catch (err) {
    console.error(`Erro interno em PUT /categorias/${req.params.id}:`, err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// =========================
// DELETE /categorias/:id
// =========================

app.delete('/categorias/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const existente = await buscarCategoriaPorId(id);

    if (!existente) {
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }

    const { data: filhos, error: erroFilhos } = await supabase
      .from('categorias')
      .select('id')
      .eq('parent_id', id)
      .limit(1);

    if (erroFilhos) {
      logErroSupabase(`DELETE /categorias/${id} - verificar filhos`, erroFilhos);
      return res.status(500).json({ error: 'Erro ao verificar filhos da categoria.' });
    }

    if (filhos && filhos.length > 0) {
      return res.status(400).json({
        error: 'Não é possível excluir esta categoria porque ela possui subitens vinculados.'
      });
    }

    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id', id);

    if (error) {
      logErroSupabase(`DELETE /categorias/${id}`, error);
      return res.status(500).json({ error: 'Erro ao excluir categoria.' });
    }

    res.json({ message: 'Categoria excluída com sucesso.' });
  } catch (err) {
    console.error(`Erro interno em DELETE /categorias/${req.params.id}:`, err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

