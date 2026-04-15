const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// =========================
// VARIÁVEIS DE AMBIENTE
// =========================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// =========================
// LOG DE INICIALIZAÇÃO
// =========================

console.log('====================================');
console.log('🚀 Iniciando servidor...');
console.log('PORT:', PORT);
console.log('SUPABASE_URL:', supabaseUrl);
console.log('SUPABASE_KEY existe?', !!supabaseKey);
console.log('====================================');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERRO: Variáveis de ambiente não definidas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =========================
// ROTA INICIAL
// =========================

app.get('/', (req, res) => {
  res.send('API Planejamento Financeiro 🚀');
});

// =========================
// DEBUG (ESSENCIAL AGORA)
// =========================

app.get('/debug-supabase', (req, res) => {
  try {
    const rawUrl = process.env.SUPABASE_URL || null;
    const hostname = rawUrl ? new URL(rawUrl).hostname : null;

    res.json({
      supabaseUrl: rawUrl,
      hostname,
      hasSupabaseKey: !!process.env.SUPABASE_KEY
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao analisar SUPABASE_URL',
      details: String(error)
    });
  }
});

// =========================
// GET /categorias
// =========================

app.get('/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*');

    if (error) {
      console.error('❌ Erro Supabase:', error);
      return res.status(500).json({ error: 'Erro ao buscar categorias.' });
    }

    res.json(data);
  } catch (err) {
    console.error('❌ Erro geral:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// =========================
// START
// =========================

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
