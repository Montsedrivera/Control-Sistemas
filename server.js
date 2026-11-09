const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Configuración completa de CORS (gestiona peticiones normales y OPTIONS automáticamente)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));

// Aumentar el límite del body para soportar PDFs o respaldos grandes en Base64
app.use(express.json({ limit: '50mb' }));

// Configuración de la conexión a MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sistemas',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Comprobar la conexión al iniciar
pool.getConnection()
  .then(conn => {
    console.log('✅ Conexión exitosa a la base de datos MySQL (sistemas)');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Error al conectar con MySQL:', err.message);
  });

// --- ENDPOINTS DE ACTIVIDADES ---
app.get('/api/actividades', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM actividades ORDER BY id ASC');
    const formatted = rows.map(a => ({
      id: a.id,
      origin: a.origen,
      category: a.categoria,
      workType: a.tipo_trabajo,
      branch: a.sucursal,
      equipment: a.equipo,
      problem: a.problema,
      action: a.accion_realizada,
      detectionDate: a.fecha_deteccion ? a.fecha_deteccion.toISOString().split('T')[0] : '',
      dueDate: a.fecha_compromiso ? a.fecha_compromiso.toISOString().split('T')[0] : '',
      priority: a.prioridad,
      status: a.estatus,
      progress: a.progreso,
      updatedAt: a.actualizado_en
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/actividades', async (req, res) => {
  const { id, origin, category, workType, branch, equipment, problem, action, detectionDate, dueDate, priority, status, progress } = req.body;
  try {
    if (id) {
      await pool.query(
        `UPDATE actividades SET 
          origen=?, categoria=?, tipo_trabajo=?, sucursal=?, equipo=?, problema=?, 
          accion_realizada=?, fecha_deteccion=?, fecha_compromiso=?, prioridad=?, estatus=?, progreso=?
         WHERE id=?`,
        [origin, category, workType, branch, equipment, problem, action || null, detectionDate, dueDate || null, priority, status, progress, id]
      );
      res.json({ message: 'Actividad actualizada', id });
    } else {
      const [result] = await pool.query(
        `INSERT INTO actividades 
          (origen, categoria, tipo_trabajo, sucursal, equipo, problema, accion_realizada, fecha_deteccion, fecha_compromiso, prioridad, estatus, progreso)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [origin, category, workType, branch, equipment, problem, action || null, detectionDate, dueDate || null, priority, status, progress]
      );
      res.json({ message: 'Actividad registrada', id: result.insertId });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ENDPOINTS DE COMPRAS ---
app.get('/api/compras', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM compras ORDER BY id ASC');
    const formatted = rows.map(c => ({
      id: c.id,
      title: c.titulo,
      priority: c.prioridad,
      branch: c.sucursal,
      dept: c.departamento,
      status: c.estatus,
      date: c.fecha_limite ? c.fecha_limite.toISOString().split('T')[0] : '',
      selectedOption: c.opcion_seleccionada,
      notes: c.notas,
      p1: { name: c.p1_proveedor, price: c.p1_precio, time: c.p1_tiempo_entrega, notes: c.p1_notas, url: c.p1_url },
      p2: { name: c.p2_proveedor, price: c.p2_precio, time: c.p2_tiempo_entrega, notes: c.p2_notas, url: c.p2_url },
      p3: { name: c.p3_proveedor, price: c.p3_precio, time: c.p3_tiempo_entrega, notes: c.p3_notas, url: c.p3_url }
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/compras', async (req, res) => {
  const { id, title, priority, branch, dept, status, date, selectedOption, notes, p1, p2, p3 } = req.body;
  try {
    if (id) {
      await pool.query(
        `UPDATE compras SET 
          titulo=?, prioridad=?, sucursal=?, departamento=?, estatus=?, fecha_limite=?, opcion_seleccionada=?, notas=?,
          p1_proveedor=?, p1_precio=?, p1_tiempo_entrega=?, p1_notas=?, p1_url=?,
          p2_proveedor=?, p2_precio=?, p2_tiempo_entrega=?, p2_notas=?, p2_url=?,
          p3_proveedor=?, p3_precio=?, p3_tiempo_entrega=?, p3_notas=?, p3_url=?
         WHERE id=?`,
        [
          title, priority, branch, dept, status, date || null, selectedOption, notes,
          p1?.name || null, p1?.price || null, p1?.time || null, p1?.notes || null, p1?.url || p1?.pdfData || null,
          p2?.name || null, p2?.price || null, p2?.time || null, p2?.notes || null, p2?.url || p2?.pdfData || null,
          p3?.name || null, p3?.price || null, p3?.time || null, p3?.notes || null, p3?.url || p3?.pdfData || null,
          id
        ]
      );
      res.json({ message: 'Compra actualizada', id });
    } else {
      const [result] = await pool.query(
        `INSERT INTO compras 
          (titulo, prioridad, sucursal, departamento, estatus, fecha_limite, opcion_seleccionada, notas,
           p1_proveedor, p1_precio, p1_tiempo_entrega, p1_notas, p1_url,
           p2_proveedor, p2_precio, p2_tiempo_entrega, p2_notas, p2_url,
           p3_proveedor, p3_precio, p3_tiempo_entrega, p3_notas, p3_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title, priority, branch, dept, status, date || null, selectedOption, notes,
          p1?.name || null, p1?.price || null, p1?.time || null, p1?.notes || null, p1?.url || p1?.pdfData || null,
          p2?.name || null, p2?.price || null, p2?.time || null, p2?.notes || null, p2?.url || p2?.pdfData || null,
          p3?.name || null, p3?.price || null, p3?.time || null, p3?.notes || null, p3?.url || p3?.pdfData || null
        ]
      );
      res.json({ message: 'Compra registrada', id: result.insertId });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- POST: IMPORTAR RESPALDO MASIVO JSON A MYSQL ---
app.post('/api/importar-backup', async (req, res) => {
  const { activities: newActivities, compras: newCompras } = req.body;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    if (Array.isArray(newActivities)) {
      for (const a of newActivities) {
        await connection.query(
          `INSERT INTO actividades 
            (id, origen, categoria, tipo_trabajo, sucursal, equipo, problema, accion_realizada, fecha_deteccion, fecha_compromiso, prioridad, estatus, progreso)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            origen=VALUES(origen), categoria=VALUES(categoria), tipo_trabajo=VALUES(tipo_trabajo),
            sucursal=VALUES(sucursal), equipo=VALUES(equipo), problema=VALUES(problema),
            accion_realizada=VALUES(accion_realizada), fecha_deteccion=VALUES(fecha_deteccion),
            fecha_compromiso=VALUES(fecha_compromiso), prioridad=VALUES(prioridad),
            estatus=VALUES(estatus), progreso=VALUES(progreso)`,
          [
            a.id || null, a.origin, a.category, a.workType, a.branch, a.equipment, a.problem,
            a.action || null, a.detectionDate || null, a.dueDate || null, a.priority, a.status, a.progress || 0
          ]
        );
      }
    }

    if (Array.isArray(newCompras)) {
      for (const c of newCompras) {
        await connection.query(
          `INSERT INTO compras 
            (id, titulo, prioridad, sucursal, departamento, estatus, fecha_limite, opcion_seleccionada, notas,
             p1_proveedor, p1_precio, p1_tiempo_entrega, p1_notas, p1_url,
             p2_proveedor, p2_precio, p2_tiempo_entrega, p2_notas, p2_url,
             p3_proveedor, p3_precio, p3_tiempo_entrega, p3_notas, p3_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            titulo=VALUES(titulo), prioridad=VALUES(prioridad), sucursal=VALUES(sucursal),
            departamento=VALUES(departamento), estatus=VALUES(estatus), fecha_limite=VALUES(fecha_limite),
            opcion_seleccionada=VALUES(opcion_seleccionada), notas=VALUES(notas),
            p1_proveedor=VALUES(p1_proveedor), p1_precio=VALUES(p1_precio), p1_tiempo_entrega=VALUES(p1_tiempo_entrega), p1_notas=VALUES(p1_notas), p1_url=VALUES(p1_url),
            p2_proveedor=VALUES(p2_proveedor), p2_precio=VALUES(p2_precio), p2_tiempo_entrega=VALUES(p2_tiempo_entrega), p2_notas=VALUES(p2_notas), p2_url=VALUES(p2_url),
            p3_proveedor=VALUES(p3_proveedor), p3_precio=VALUES(p3_precio), p3_tiempo_entrega=VALUES(p3_tiempo_entrega), p3_notas=VALUES(p3_notas), p3_url=VALUES(p3_url)`,
          [
            c.id || null, c.title, c.priority, c.branch, c.dept, c.status, c.date || null, c.selectedOption || null, c.notes || null,
            c.p1?.name || null, c.p1?.price || null, c.p1?.time || null, c.p1?.notes || null, c.p1?.url || null,
            c.p2?.name || null, c.p2?.price || null, c.p2?.time || null, c.p2?.notes || null, c.p2?.url || null,
            c.p3?.name || null, c.p3?.price || null, c.p3?.time || null, c.p3?.notes || null, c.p3?.url || null
          ]
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Respaldo importado y sincronizado con MySQL exitosamente.' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor listo escuchando en http://localhost:${PORT}`);
});