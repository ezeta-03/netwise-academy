import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Send, X } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchCommunityPosts, createCommunityPost, addCommunityComment } from '../../lib/db';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const NewPostModal = ({ onClose, onSaved, courseId, groupName, authorName }) => {
  const { addToast } = useUI();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) { addToast('Escribe un título y el contenido del anuncio.', 'error'); return; }
    setSaving(true);
    try {
      await createCommunityPost({ courseId, groupName, authorName, authorRole: 'Docente', isAnnouncement: true, title: title.trim(), body: body.trim() });
      addToast('Anuncio publicado.', 'success');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head"><div className="admin-modal-title">Publicar anuncio</div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
        <div className="admin-field"><label>Título</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Prepara tu próxima clase" /></div>
        <div className="admin-field"><label>Mensaje</label><textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Publicando...' : 'Publicar anuncio'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const PostCard = ({ post, courseId, currentUser, onCommented }) => {
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const submitComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await addCommunityComment(courseId, post.id, {
        author: currentUser?.displayName || 'Docente', role: 'Docente', text: comment.trim(), createdAt: new Date().toISOString(),
      });
      setComment('');
      onCommented();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dash-post-card" style={{ marginBottom: 16 }}>
      <div className="dash-post-head">
        <div className="dash-post-avatar">{getInitials(post.authorName)}</div>
        <div>
          <div className="dash-post-author">{post.authorName} · {post.authorRole}</div>
        </div>
        {post.isAnnouncement && <span className="admin-status admin-status-green" style={{ marginLeft: 'auto' }}>Anuncio del curso</span>}
      </div>
      <div className="dash-post-title">{post.title}</div>
      <p className="dash-post-body">{post.body}</p>

      <div className="dash-post-comments">
        <div className="admin-cell-sub" style={{ marginBottom: 10 }}>{(post.comments || []).length} comentario{(post.comments || []).length === 1 ? '' : 's'}</div>
        {(post.comments || []).map((c, i) => (
          <div key={i} className="dash-comment">
            <div className="dash-post-avatar" style={{ width: 28, height: 28, fontSize: '.68rem' }}>{getInitials(c.author)}</div>
            <div className="dash-comment-body">
              <span className="dash-comment-author">{c.author} · {c.role}</span>
              <span className="dash-comment-meta">{new Date(c.createdAt).toLocaleDateString('es-PE')}</span>
              <div>{c.text}</div>
            </div>
          </div>
        ))}
        <div className="dash-comment-form">
          <input placeholder="Comentar este anuncio" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitComment()} />
          <button className="admin-btn-edit" onClick={submitComment} disabled={sending}><Send size={13} /> Comentar</button>
        </div>
      </div>
    </div>
  );
};

const TeacherCourseComunidad = () => {
  const { course, group } = useOutletContext();
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => fetchCommunityPosts(course.id).then((list) => { setPosts(list); setLoading(false); }), [course.id]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Comunidad</h1>
          <p className="admin-page-sub">{course.title}{group?.name ? ` · Grupo ${group.name}` : ''}</p>
        </div>
        <button className="admin-btn-edit" onClick={() => setModalOpen(true)}><Plus size={15} /> Publicar anuncio</button>
      </div>

      {loading ? <div className="admin-empty-hint">Cargando comunidad...</div> : posts.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>Todavía no hay publicaciones. Comparte el primer anuncio del curso.</div>
      ) : posts.map((post) => <PostCard key={post.id} post={post} courseId={course.id} currentUser={currentUser} onCommented={load} />)}

      {modalOpen && (
        <NewPostModal
          courseId={course.id}
          groupName={group?.name}
          authorName={currentUser?.displayName || 'Docente'}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default TeacherCourseComunidad;
