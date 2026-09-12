import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { fetchAuditLog } from '../../lib/db';

const AdminHistorial = () => {
  const [log, setLog] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAuditLog().then((list) => { setLog(list); setLoading(false); }); }, []);

  const filtered = log.filter((l) => `${l.actor} ${l.message}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="anim-fade-up d1">
      <span className="admin-eyebrow">Administración / Netwise Academy</span>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Historial de cambios</h1>
          <p className="admin-page-sub">Quién hizo qué y cuándo, en todo el panel de administración.</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar en el historial..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <div className="admin-table-wrap">
        {loading ? <div className="admin-empty-hint">Cargando historial...</div> : filtered.length === 0 ? (
          <div className="admin-empty-hint">Todavía no hay cambios registrados. Aparecerán aquí apenas uses el panel.</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Fecha</th><th>Quién</th><th>Cambio</th></tr></thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td className="admin-cell-sub">{new Date(l.createdAt).toLocaleString('es-PE')}</td>
                  <td className="admin-cell-name">{l.actor}</td>
                  <td>{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminHistorial;
