import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Tag, CreditCard, Smartphone, Landmark, Lock, UserCircle2 } from 'lucide-react';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useEnrollment } from '../hooks/useEnrollment';
import { fetchCoupons, redeemCoupon, saveUserPhone, createOrder, fetchLiveSessions } from '../lib/db';
import { getLiveSessionStatus } from '../lib/liveSessionStatus';
import logoNetwise from '../assets/NETWISE ACADEMY WEB/logo_netwise.webp';

const STEPS = [
  { id: 1, label: 'Tus datos' },
  { id: 2, label: 'Pago' },
  { id: 3, label: 'Confirmación' },
];

const PAYMENT_METHODS = [
  { id: 'yape', label: 'Yape Empresas / Plin Negocios', icon: Smartphone, soon: false },
  { id: 'card', label: 'Tarjeta de crédito/débito', icon: CreditCard, soon: false },
  { id: 'transfer', label: 'Transferencia', icon: Landmark, soon: true, hidden: true },
];

const fmtMoney = (n) => `S/ ${n.toFixed(2)}`;

const Checkout = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { courses } = useCourseOfferings();
  const { currentUser, login, register, loginWithGoogle } = useAuth();
  const { addToast } = useUI();

  const course = courses.find((c) => c.id.toString() === courseId);
  const { isEnrolled, enroll } = useEnrollment(course);

  const [step, setStep] = useState(currentUser ? 2 : 1);
  const [authTab, setAuthTab] = useState('register');
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponChecking, setCouponChecking] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('yape');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [processing, setProcessing] = useState(false);

  const [firstClass, setFirstClass] = useState(null);

  useEffect(() => {
    if (currentUser && step === 1) {
      if (phone.trim()) saveUserPhone(currentUser.uid, phone.trim());
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (!course) return;
    fetchLiveSessions().then((list) => {
      const upcoming = list
        .filter((s) => s.courseId?.toString() === course.id.toString() && ['upcoming', 'live'].includes(getLiveSessionStatus(s)))
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      setFirstClass(upcoming[0] || null);
    });
  }, [course]);

  if (!course) {
    return (
      <div className="view active">
        <div className="empty-state" style={{ padding: '96px 24px' }}>
          <p>Este curso no existe o todavía no está disponible.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/catalog')}>Ver catálogo</button>
        </div>
      </div>
    );
  }

  if (isEnrolled && step !== 3) {
    navigate(`/player/${course.id}/1-1`, { replace: true });
    return null;
  }

  const originalPrice = course.promoPercent ? course.price / (1 - course.promoPercent / 100) : course.price;
  const promoDiscount = course.promoPercent ? originalPrice - course.price : 0;
  const couponDiscount = appliedCoupon ? originalPrice * (appliedCoupon.discountPercent / 100) : 0;
  const usingCoupon = !!appliedCoupon && couponDiscount > promoDiscount;
  const bestDiscount = Math.max(promoDiscount, couponDiscount);
  const discountPercent = usingCoupon ? appliedCoupon.discountPercent : course.promoPercent;
  const finalPrice = Math.round((originalPrice - bestDiscount) * 100) / 100;

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (password.length < 8) { setAuthError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirmPassword) { setAuthError('Las contraseñas no coinciden.'); return; }
    if (!acceptedTerms) { setAuthError('Debes aceptar los términos y condiciones y la política de privacidad.'); return; }
    setAuthLoading(true);
    try {
      await register(email, password, name);
    } catch (err) {
      setAuthError(err.message?.includes('email-already') ? 'Ese correo ya tiene una cuenta. Inicia sesión.' : 'No se pudo crear la cuenta. Intenta de nuevo.');
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      await login(loginEmail, loginPassword);
    } catch {
      setAuthError('Credenciales incorrectas.');
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError('');
    setSocialLoading(true);
    try {
      await loginWithGoogle();
    } catch {
      setAuthError('No se pudo conectar con Google. Intenta de nuevo.');
      setSocialLoading(false);
    }
  };

  const applyCoupon = async () => {
    setCouponError('');
    if (!couponCode.trim()) return;
    setCouponChecking(true);
    try {
      const list = await fetchCoupons();
      const match = list.find((c) => c.code?.toUpperCase() === couponCode.trim().toUpperCase());
      if (!match) { setCouponError('Cupón no válido.'); setAppliedCoupon(null); return; }
      if (match.active === false) { setCouponError('Este cupón ya no está activo.'); setAppliedCoupon(null); return; }
      if (match.endDate && new Date(match.endDate) < new Date()) { setCouponError('Este cupón ya venció.'); setAppliedCoupon(null); return; }
      if (match.maxUses && (match.usedCount || 0) >= match.maxUses) { setCouponError('Este cupón alcanzó su límite de usos.'); setAppliedCoupon(null); return; }
      if (match.scope !== 'all' && match.scope?.toString() !== course.id.toString()) { setCouponError('Este cupón no aplica a este curso.'); setAppliedCoupon(null); return; }
      setAppliedCoupon(match);
      addToast('Cupón aplicado.', 'success');
    } finally {
      setCouponChecking(false);
    }
  };

  const handlePay = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1400)); // simulación de pasarela, igual que el checkout de un curso
    await enroll();
    await createOrder({
      uid: currentUser.uid,
      studentName: currentUser.displayName || currentUser.email,
      courseId: course.id,
      courseTitle: course.title,
      amount: finalPrice,
      status: 'paid',
    });
    if (usingCoupon) await redeemCoupon(appliedCoupon.id);
    setProcessing(false);
    setStep(3);
  };

  return (
    <div className="view active">
      <div className="checkout-topbar">
        <img src={logoNetwise} alt="Netwise Academy" />
        <button className="checkout-back-btn" onClick={() => navigate(`/course/${course.id}`)}><ArrowLeft size={14} /> Volver al curso</button>
      </div>

      <div className="checkout-body">
        <div className="checkout-inner">
          <div className="checkout-stepper">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <span className={`checkout-step-pill ${step === s.id ? 'active' : step > s.id ? 'done' : ''}`}>
                  {step > s.id ? <Check size={12} /> : s.id} {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="checkout-step-divider" />}
              </React.Fragment>
            ))}
          </div>

          {step === 1 && (
            <>
              <h1 className="checkout-title">Antes de pagar, <em>cuéntanos quién eres.</em></h1>
              <p className="checkout-sub">Crea tu cuenta o inicia sesión para reservar tu cupo en {course.title}.</p>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="checkout-title">Elige tu método de <em>pago.</em></h1>
              <p className="checkout-sub">Último paso antes de reservar tu cupo en {course.title}.</p>
            </>
          )}

          {step < 3 && (
            <div className="checkout-grid">
              <div className="checkout-card">
                {step === 1 && (
                  <>
                    <div className="checkout-tabs">
                      <button className={`checkout-tab ${authTab === 'register' ? 'active' : ''}`} onClick={() => { setAuthTab('register'); setAuthError(''); }}>Crear cuenta</button>
                      <button className={`checkout-tab ${authTab === 'login' ? 'active' : ''}`} onClick={() => { setAuthTab('login'); setAuthError(''); }}>Iniciar sesión</button>
                    </div>

                    {authError && <div className="checkout-error">{authError}</div>}

                    {authTab === 'register' ? (
                      <form onSubmit={handleRegister}>
                        <button type="button" className="checkout-social-btn" disabled={socialLoading} onClick={handleGoogleAuth}>
                          {socialLoading ? <Loader2 size={16} className="spin" /> : <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.05l3.02-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>}
                          Registrarte con Google
                        </button>
                        <div className="checkout-divider">o regístrate con tu correo</div>

                        <div className="admin-field"><label>Nombre completo</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. María Fernández" required /></div>
                        <div className="checkout-field-row">
                          <div className="admin-field"><label>Correo electrónico</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required /></div>
                          <div className="admin-field"><label>Teléfono / WhatsApp</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51 987 654 321" /></div>
                        </div>
                        <div className="checkout-field-row">
                          <div className="admin-field">
                            <label>Contraseña</label>
                            <div className="auth-input-wrap">
                              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required />
                              <button type="button" className="auth-input-toggle" style={{ color: '#9795A8' }} onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                            </div>
                          </div>
                          <div className="admin-field"><label>Confirmar contraseña</label><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite tu contraseña" required /></div>
                        </div>
                        <label className="checkout-terms-row">
                          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                          Acepto los <a>Términos y condiciones</a> y la <a>Política de privacidad</a> de Netwise Academy.
                        </label>
                        <button type="submit" className="checkout-submit-btn" disabled={authLoading}>
                          {authLoading ? <Loader2 size={16} className="spin" /> : 'Crear cuenta y continuar →'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleLogin}>
                        <button type="button" className="checkout-social-btn" disabled={socialLoading} onClick={handleGoogleAuth}>
                          {socialLoading ? <Loader2 size={16} className="spin" /> : <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.05l3.02-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>}
                          Continuar con Google
                        </button>
                        <div className="checkout-divider">o inicia sesión con tu correo</div>

                        <div className="admin-field"><label>Correo electrónico</label><input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="tu@correo.com" required /></div>
                        <div className="admin-field">
                          <label>Contraseña</label>
                          <div className="auth-input-wrap">
                            <input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Tu contraseña" required />
                            <button type="button" className="auth-input-toggle" style={{ color: '#9795A8' }} onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                          </div>
                        </div>
                        <button type="submit" className="checkout-submit-btn" disabled={authLoading}>
                          {authLoading ? <Loader2 size={16} className="spin" /> : 'Iniciar sesión y continuar →'}
                        </button>
                      </form>
                    )}
                  </>
                )}

                {step === 2 && (
                  <>
                    {currentUser && (
                      <div className="checkout-session-chip">
                        <UserCircle2 size={16} />
                        Conectado como <strong>{currentUser.displayName || currentUser.email}</strong>
                      </div>
                    )}
                    <div className="admin-panel-head" style={{ marginBottom: 4 }}>
                      <span className="admin-panel-title">2 · Método de pago</span>
                    </div>
                    <p className="admin-cell-sub" style={{ marginBottom: 18 }}>Todos los pagos son procesados de forma segura.</p>

                    <div className="checkout-pay-methods">
                      {PAYMENT_METHODS.filter((m) => !m.hidden).map((m) => (
                        <label key={m.id} className={`checkout-pay-method ${paymentMethod === m.id ? 'selected' : ''}`}>
                          <input type="radio" name="pay" checked={paymentMethod === m.id} onChange={() => setPaymentMethod(m.id)} />
                          <m.icon size={16} /> {m.label}
                          {m.soon && <span className="checkout-pay-soon">Próximamente</span>}
                        </label>
                      ))}
                    </div>

                    {paymentMethod === 'card' ? (
                      <>
                        <div className="admin-field"><label>Número de tarjeta</label><input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" required /></div>
                        <div className="checkout-field-row">
                          <div className="admin-field"><label>Vencimiento</label><input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/AA" required /></div>
                          <div className="admin-field"><label>CVV</label><input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" required /></div>
                        </div>
                        <p className="checkout-pay-note"><Lock size={13} /> Tu información está protegida y encriptada.</p>
                      </>
                    ) : paymentMethod === 'yape' ? (
                      <div className="checkout-pay-placeholder">Al confirmar, nuestro equipo te contactará por WhatsApp con los datos para completar tu pago por Yape o Plin.</div>
                    ) : (
                      <div className="checkout-pay-placeholder">Estamos habilitando este método de pago. Por ahora, continúa con Yape/Plin o tarjeta.</div>
                    )}

                    <button
                      className="checkout-submit-btn"
                      style={{ marginTop: 20 }}
                      disabled={processing || (paymentMethod === 'card' && (!cardNumber || !cardExpiry || !cardCvv)) || (PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.soon)}
                      onClick={handlePay}
                    >
                      {processing ? <Loader2 size={16} className="spin" /> : `Confirmar y pagar ${fmtMoney(finalPrice)} →`}
                    </button>
                  </>
                )}
              </div>

              <div className="checkout-summary">
                <div className="checkout-summary-title">{course.title}</div>
                <p className="checkout-summary-desc">{course.description}</p>

                {course.promoPercent > 0 && <span className="checkout-summary-price-old">Antes S/{originalPrice.toFixed(2)}</span>}
                {discountPercent > 0 && <span className="checkout-summary-badge">-{discountPercent}%</span>}
                <div className="checkout-summary-price">S/<strong>{Math.floor(finalPrice)}</strong>.{(finalPrice % 1).toFixed(2).slice(2)}</div>

                <div className="checkout-coupon-label"><Tag size={13} /> ¿Tienes un cupón?</div>
                <div className="checkout-coupon-row">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Ej. NETWISE10" />
                  <button onClick={applyCoupon} disabled={couponChecking}>{couponChecking ? '...' : 'Aplicar'}</button>
                </div>
                {couponError && <p className="checkout-coupon-msg error">{couponError}</p>}
                {usingCoupon && !couponError && <p className="checkout-coupon-msg ok">Cupón "{appliedCoupon.code}" aplicado.</p>}

                <div className="checkout-price-breakdown">
                  <div className="checkout-price-row"><span>Precio regular</span><span>S/ {originalPrice.toFixed(2)}</span></div>
                  {bestDiscount > 0 && (
                    <div className="checkout-price-row discount">
                      <span>{usingCoupon ? `Descuento con cupón · ${discountPercent}%` : `Descuento promocional · ${discountPercent}%`}</span>
                      <span>-S/ {bestDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="checkout-price-row total"><span>{step === 1 ? 'Subtotal de ejemplo' : 'Total de ejemplo'}</span><span>{fmtMoney(finalPrice)}</span></div>
                </div>

                {step === 1 && <button className="checkout-summary-cta" disabled>Confirmar y pagar {fmtMoney(finalPrice)} →</button>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="checkout-confirm-wrap">
              <div className="checkout-confirm-card">
                <img src={logoNetwise} alt="Netwise Academy" />
                <div className="checkout-confirm-icon"><Check size={26} /></div>
                <div className="checkout-confirm-title">¡Bienvenido/a a Netwise!</div>
                <div className="checkout-confirm-sub">Ya casi empiezas.</div>
                <p className="checkout-confirm-desc">Tu inscripción y tu pago fueron confirmados. Revisa la fecha de tu primera clase en vivo y entra a tu aula cuando quieras.</p>

                <div className="checkout-confirm-details">
                  <div className="checkout-confirm-row"><span>Curso</span><span>{course.title}</span></div>
                  <div className="checkout-confirm-row">
                    <span>Primera clase</span>
                    <span>{firstClass ? `${new Date(firstClass.startsAt).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })} · ${new Date(firstClass.startsAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}` : 'Por confirmar'}</span>
                  </div>
                  <div className="checkout-confirm-row"><span>Estado del pago</span><span className="admin-status admin-status-green" style={{ display: 'inline-flex' }}>Confirmado</span></div>
                </div>

                <button className="checkout-confirm-cta" onClick={() => navigate(`/player/${course.id}/1-1`)}>Acceder al aula →</button>
                <a className="checkout-confirm-link" onClick={() => navigate('/')}>Volver al inicio</a>
                <p className="checkout-confirm-footnote">Enviamos un correo de confirmación a {currentUser?.email}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Checkout;
