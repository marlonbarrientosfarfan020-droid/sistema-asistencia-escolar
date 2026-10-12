const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function main() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('No se encontró el archivo .env');
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (!match) {
    throw new Error('DATABASE_URL no encontrada en .env');
  }

  const dbUrl = match[1].replace(/["']/g, '').trim();
  const parsed = new URL(dbUrl);

  // GUARDIA ESTRICTA: Solo permitir localhost
  const esLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (!esLocal || parsed.hostname.includes('neon.tech')) {
    console.error('⛔ BLOQUEO DE SEGURIDAD: DATABASE_URL no apunta a localhost. Operación abortada.');
    process.exit(1);
  }

  const usuario = process.argv[2] || 'admin';
  const passwordPlano = process.argv[3] || 'admin123';
  const rol = (process.argv[4] || 'ADMIN').toUpperCase();
  const colegioId = 'SANTA_RITA_001';

  console.log('=== CREACIÓN SEGURA DE ADMINISTRADOR EN LOCALHOST ===');
  console.log(`Base de datos destino: ${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`);
  console.log(`Usuario: "${usuario}"`);
  console.log(`Rol: "${rol}"`);
  console.log(`Colegio: "${colegioId}"`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  // 1. Asegurar Colegio
  await client.query(`
    INSERT INTO "Colegio" (codigo, nombre, "nombreCorto", direccion, estado, "updatedAt")
    VALUES ($1, 'I.E. Santa Rita de Casia', 'Santa Rita', 'Cañete, Lima', 'ACTIVO', NOW())
    ON CONFLICT (codigo) DO NOTHING
  `, [colegioId]);

  // 2. Generar hash bcrypt compatible con Next.js (bcryptjs)
  const passwordHash = await bcrypt.hash(passwordPlano, 10);

  // 3. Crear o actualizar usuario
  await client.query(`
    INSERT INTO "Usuario" (usuario, password, rol, estado, "colegioId", "createdAt")
    VALUES ($1, $2, $3, true, $4, NOW())
    ON CONFLICT (usuario) DO UPDATE
    SET password = EXCLUDED.password,
        rol = EXCLUDED.rol,
        estado = true,
        "colegioId" = EXCLUDED."colegioId"
  `, [usuario, passwordHash, rol, colegioId]);

  console.log('✅ Usuario administrador creado/actualizado con éxito en PostgreSQL local.');
  console.log('--- Ya puedes iniciar sesión en: http://localhost:3001/login ---');

  await client.end();
}

main().catch((err) => {
  console.error('Error creando administrador local:', err.message);
  process.exit(1);
});
