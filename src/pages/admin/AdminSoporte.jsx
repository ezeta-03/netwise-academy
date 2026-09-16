import React, { useEffect, useState } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { fetchAllSupportRequests, updateSupportRequestStatus } from '../../lib/db';

const STATUS = {
  pending: { label: 'Pendiente', cls: 'admin-status-amber' },
  resolved: { label: 'Resuelto', cls: 'admin-status-green' },
};

const ROLE_LABEL = { student: 'Estudiante', teacher: 'Docente', admin: 'Admin' };

const TYPE_LABEL = { plataforma: 'Soporte de plataforma', tutoria: 'Tutoría' };

const AdminSoporte = () => {
  const { addToast } = useUI();
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = () => fetchAllSupportRequests().then((list) => { setRequests(list); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const resolve = async (r) => {
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'resolved' } : x)));
    try {
      await updateSupportRequestStatus(r.id, 'resolved');
      addToast(`Solicitud de ${r.requesterName} marcada como resuelta.`, 'success');
    } catch {
      setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: r.status } : x)));
      addToast('No se pudo actualizar la solicitud. Intenta de nuevo.', 'error');
    }
  };

  const filtered = requests.filter((r) => {
    const matchesSearch = `${r.requesterName} ${r.courseTitle || ''} ${r.message || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (r.status || 'pending') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = requests.filter((r) => (r.status || 'pending') === 'pending').length;

  return (
    <div className="anim-fade-up d1">
      <span className="admin-eyebrow">Administración / Netwise Academy</span>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Soporte</h1>
          <p className="admin-page-sub">Solicitudes de ayuda y tutorías de estudiantes y docentes.</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar por nombre, curso o mensaje..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos los registros</option>
          <option value="pending">Pendientes</option>
          <option value="resolved">Resueltos</option>
        </select>
      </div>

      <div className="admin-table-wrap">
        {loading ? <div className="admin-empty-hint">Cargando solicitudes...</div> : filtered.length === 0 ? (
          <div className="admin-empty-hint">{requests.length === 0 ? 'Todavía no hay solicitudes de soporte.' : 'No hay solicitudes que coincidan con tu búsqueda.'}</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Solicitante</th><th>Tipo</th><th>Mensaje</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((r) => {
                const status = STATUS[r.status || 'pending'];
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="admin-cell-name">{r.requesterName || r.requesterUid}</div>
                      <div className="admin-cell-sub">{ROLE_LABEL[r.requesterRole] || r.requesterRole}</div>
                    </td>
                    <td>
                      <div className="admin-cell-name">{TYPE_LABEL[r.type] || r.type}</div>
                      <div className="admin-cell-sub">{r.courseTitle || '—'}{r.groupName ? ` · Grupo ${r.groupName}` : ''}</div>
                    </td>
                    <td className="admin-cell-sub" style={{ maxWidth: 280 }}>{r.message || '—'}</td>
                    <td className="admin-cell-sub">{r.createdAt ? new Date(r.createdAt).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td><span className={`admin-status ${status.cls}`}>{status.label}</span></td>
                    <td>
                      {(r.status || 'pending') === 'pending' && (
                        <button className="admin-btn-ghost" onClick={() => resolve(r)}><CheckCircle2 size={13} /> Marcar resuelto</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {requests.length > 0 && (
          <div className="admin-footnote">
            <span>{pendingCount} pendiente{pendingCount === 1 ? '' : 's'} de {requests.length} en total</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSoporte;
