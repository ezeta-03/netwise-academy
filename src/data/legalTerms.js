// Términos y Condiciones de Servicio y Política de Privacidad de Netwise Academy.
// Fuente: "src/assets/NETWISE ACADEMY WEB/data/TÉRMINOS Y CONDICIONES - PRIVACIDAD
// DE DATOS  NETWISE ACADEMY.docx". Si coordinación actualiza el .docx, actualizar
// también este archivo (y `LEGAL_UPDATED_AT`).
//
// Cada sección tiene `blocks`: { p } párrafo, { ul: [...] } lista (un ítem puede
// ser texto o { term, text } para resaltar el término) y { table } tabla.

export const LEGAL_UPDATED_AT = '24 de septiembre de 2026';

const PROVIDER = 'GRUPO ZAAZMAGO, con RUC N.° 20541474499, domicilio en Jr. Julio César Tello 920, distrito de El Tambo, Huancayo, Junín, Perú';
const PRIVACY_EMAIL = 'privacidad@zaazmago.com.pe';

export const LEGAL_PARTS = [
  {
    id: 'terms',
    tab: 'Términos y condiciones',
    title: 'Parte I. Términos y Condiciones de Servicio',
    sections: [
      {
        title: '1. Identificación del proveedor',
        blocks: [
          { p: `Los presentes Términos y Condiciones regulan el acceso y uso del sitio web, los formularios de inscripción, las aulas virtuales y los servicios educativos de Netwise Academy (en adelante, "Netwise Academy", "la Academia", "nosotros"), operada por ${PROVIDER}, y correo de contacto ${PRIVACY_EMAIL}.` },
          { p: 'Al inscribirte en un curso, crear una cuenta, registrarte en una master class o usar nuestros canales, declaras haber leído y aceptado estos Términos y la Política de Privacidad de la Parte II.' },
        ],
      },
      {
        title: '2. Definiciones',
        blocks: [
          { ul: [
            { term: 'Usuario o Estudiante', text: 'persona natural que se registra, se inscribe o participa en los servicios de la Academia.' },
            { term: 'Curso', text: 'programa formativo de corta duración ofrecido por Netwise Academy, con clases en vivo y material complementario.' },
            { term: 'Master class', text: 'sesión introductoria, gratuita o de pago, que sirve de presentación de un curso.' },
            { term: 'Plataforma', text: 'sitio web, aula virtual, herramientas de videoconferencia y canales de mensajería que usa la Academia para prestar el servicio.' },
            { term: 'Contenidos', text: 'presentaciones, casos, lecturas, plantillas, videos, grabaciones, evaluaciones y cualquier otro material entregado.' },
          ] },
        ],
      },
      {
        title: '3. Naturaleza de los servicios',
        blocks: [
          { p: '3.1. Netwise Academy ofrece cursos y talleres de formación libre en áreas como marketing digital, branding y gestión de marca, y creación de negocios digitales, entre otros, en modalidad virtual sincrónica (clases en vivo) con apoyo asincrónico (grabaciones y materiales), y en modalidades presenciales y semipresenciales, bajo días y horarios previamente establecidos.' },
          { p: '3.2. Los cursos tienen una duración de 4 semanas, organizados en 8 sesiones (o según se indique en la ficha de cada curso). El calendario, horarios, docente y contenidos de cada curso se publican en su ficha informativa.' },
          { p: '3.3. Los cursos no constituyen educación superior universitaria ni técnica, no conducen a grado académico ni título profesional, y los certificados que emitimos son constancias o certificados de participación o aprovechamiento de Netwise Academy, sin valor de título oficial. Los certificados se otorgan siempre y cuando el estudiante cumpla con los requisitos mínimos de aprobación establecidos, reflejados en una nota mínima de 16 (dieciséis). De no lograr la nota mínima requerida, el estudiante podrá acceder a una constancia que evidencie haber llevado el curso, sin certificación de aprobación del mismo.' },
          { p: '3.4. Los resultados que cada estudiante obtenga dependen de su dedicación, contexto y aplicación de lo aprendido. Netwise Academy no garantiza resultados económicos, laborales ni comerciales.' },
        ],
      },
      {
        title: '4. Requisitos y cuenta de usuario',
        blocks: [
          { p: '4.1. Para inscribirte debes ser mayor de 18 años y tener capacidad legal para contratar.' },
          { p: '4.2. Debes proporcionar información veraz, completa y actualizada. Eres responsable de la confidencialidad de tus credenciales; las cuentas son personales e intransferibles y no pueden compartirse.' },
          { p: '4.3. Debes contar con los medios técnicos necesarios (dispositivo, conexión a internet estable, audio y, cuando corresponda, cámara). Los costos de conexión son de tu cargo.' },
        ],
      },
      {
        title: '5. Modalidad de las clases y grabaciones',
        blocks: [
          { p: '5.1. Las clases en vivo se dictan mediante plataformas de videoconferencia de terceros (Google Meet). Se accede únicamente a través del aula virtual y su acceso es de uso personal.' },
          { p: '5.2. Las sesiones pueden ser grabadas para ponerlas a disposición de los estudiantes inscritos. Las grabaciones estarán disponibles hasta la finalización del curso, salvo que se indique otro plazo.' },
          { p: '5.3. Está prohibido grabar, capturar, transmitir o difundir las sesiones por medios propios, así como compartir enlaces, credenciales o grabaciones con terceros.' },
        ],
      },
      {
        title: '6. Inscripción, precios y pagos',
        blocks: [
          { p: '6.1. Los precios se expresan en soles peruanos (S/) e incluyen los impuestos aplicables, salvo que se indique lo contrario. El precio vigente es el publicado al momento de tu inscripción.' },
          { p: '6.2. La inscripción se considera confirmada cuando se acredita el pago total (o de la primera cuota, si se ofrece pago fraccionado) y recibes la confirmación por correo o por el aula virtual.' },
          { p: '6.3. Los pagos se realizan mediante los medios habilitados (pasarela de pago, tarjeta, transferencia o billeteras digitales). Los datos de pago son procesados por proveedores de pago autorizados; Netwise Academy no almacena datos completos de tu tarjeta.' },
          { p: '6.4. Emitiremos el comprobante de pago electrónico correspondiente (boleta o factura) según los datos que nos proporciones. Si solicitas factura, debes indicar tu RUC correctamente antes de la emisión.' },
          { p: '6.5. Podemos ofrecer promociones, descuentos o becas con condiciones específicas, que no son acumulables salvo que se indique expresamente.' },
        ],
      },
      {
        title: '7. Cambios, reprogramaciones, cancelaciones y reembolsos',
        blocks: [
          { p: '7.1. Reprogramación por parte de la Academia. Netwise Academy puede reprogramar sesiones por causas justificadas (fuerza mayor, indisposición del docente, fallas técnicas), comunicándolo con anticipación razonable. La sesión se recuperará o se pondrá a disposición en grabación.' },
          { p: '7.2. Cancelación de un curso por la Academia. Si un curso no llega al mínimo de inscritos o no puede dictarse, podrás elegir entre (a) trasladar tu inscripción a otra fecha o curso, o (b) la devolución del 100 % de lo pagado, en un plazo no mayor a 15 días calendario, contados a partir de la fecha de inicio del curso cancelado.' },
          { p: '7.3. Desistimiento del estudiante antes del inicio. Puedes solicitar la devolución de tu pago hasta 7 días calendario antes de la fecha de inicio del curso, mediante solicitud escrita a administracion@netwise.pe. Se podrá retener únicamente el costo demostrable de comisiones de la pasarela de pago y los gastos administrativos, hasta por un tope máximo del 15 % del monto pagado.' },
          { p: '7.4. Desistimiento después del inicio. Iniciado el curso, no corresponde devolución, sin perjuicio de las alternativas de recuperación (ver punto 7.5) y de los derechos que la ley te reconoce como consumidor.' },
          { p: '7.5. Traslado de cohorte. Por causas justificadas y acreditadas, podrás solicitar una sola vez el traslado a una cohorte posterior del mismo curso, dentro de 15 días y sujeto a disponibilidad.' },
          { p: '7.6. Las devoluciones se realizan por el mismo medio de pago, dentro de 15 días calendario de aprobada la solicitud.' },
        ],
      },
      {
        title: '8. Obligaciones y conducta del estudiante',
        blocks: [
          { p: 'Te comprometes a:' },
          { ul: [
            'Usar los servicios de forma lícita, respetuosa y conforme a estos Términos.',
            'No insultar, discriminar, acosar ni interrumpir a docentes o compañeros, ni compartir contenido ilícito, ofensivo o que vulnere derechos de terceros.',
            'No usar la plataforma para actividades de spam, captación comercial no autorizada o promoción de terceros dentro de las aulas.',
            'No vulnerar, alterar ni intentar acceder sin autorización a los sistemas de la Academia.',
            'Respetar la confidencialidad de los casos, datos o experiencias compartidas en clase por otros participantes.',
          ] },
        ],
      },
      {
        title: '9. Asistencia, evaluación y certificación',
        blocks: [
          { p: '9.1. Para obtener el certificado debes cumplir los requisitos indicados en la ficha del curso, que por defecto son: asistencia (en vivo o mediante revisión de grabación, según se indique) de al menos el 75 % de las sesiones, y entrega de las actividades o proyecto final requeridos, aprobados con un promedio general mínimo de 16.' },
          { p: '9.2. Los certificados se emiten en formato digital, con datos de identificación del estudiante. Es tu responsabilidad verificar que tus nombres y apellidos estén correctamente registrados antes de finalizar el curso.' },
          { p: '9.3. Netwise Academy puede negar o retirar un certificado en caso de plagio, suplantación, incumplimiento de requisitos o conducta contraria a estos Términos.' },
        ],
      },
      {
        title: '10. Propiedad intelectual',
        blocks: [
          { p: '10.1. Todos los Contenidos, marcas, logotipos, metodologías (incluida la metodología Netwise), materiales, plantillas, presentaciones y grabaciones son de propiedad de Netwise Academy, de sus docentes o de terceros que nos han licenciado su uso, y están protegidos por el Decreto Legislativo N.° 822, Ley sobre el Derecho de Autor, y demás normas aplicables.' },
          { p: '10.2. Se te otorga una licencia personal, limitada, no exclusiva, intransferible y revocable para acceder y usar los Contenidos exclusivamente con fines formativos propios. No puedes copiar, reproducir, revender, distribuir, publicar ni crear obras derivadas para uso comercial sin autorización escrita.' },
          { p: '10.3. Trabajos del estudiante. Los proyectos, planes, prototipos o ideas de negocio que desarrolles durante el curso son de tu titularidad. Nos autorizas, de forma no exclusiva y gratuita, a usar extractos, capturas o descripciones generales de tus trabajos con fines académicos y de difusión, solo si nos das tu consentimiento expreso para cada caso.' },
          { p: '10.4. Los casos de estudio, marcos teóricos y referencias a autores o instituciones de terceros se usan con fines educativos y conservan sus derechos de origen.' },
        ],
      },
      {
        title: '11. Master classes y contenidos gratuitos',
        blocks: [
          { p: '11.1. La inscripción a una master class gratuita no implica matrícula en ningún curso ni genera obligación de pago.' },
          { p: '11.2. Al registrarte, los datos que proporciones serán tratados conforme a la Política de Privacidad. Las comunicaciones promocionales sobre nuestros cursos solo se enviarán si otorgas tu consentimiento específico para ello, y puedes retirarlo en cualquier momento.' },
          { p: '11.3. Las master classes pueden ser grabadas y su contenido es propiedad de la Academia (ver cláusula 10).' },
        ],
      },
      {
        title: '12. Disponibilidad, fallas técnicas y limitación de responsabilidad',
        blocks: [
          { p: '12.1. Nos esforzamos por mantener la Plataforma disponible, pero no garantizamos su funcionamiento ininterrumpido. Pueden ocurrir interrupciones por mantenimiento, fallas de proveedores o causas ajenas a nuestro control.' },
          { p: '12.2. Netwise Academy no es responsable por fallas de conexión, equipos o servicios de terceros del lado del estudiante, ni por el uso que hagas de la información recibida.' },
          { p: '12.3. En la máxima medida permitida por la ley, la responsabilidad total de Netwise Academy frente a un estudiante se limita al monto efectivamente pagado por el curso en cuestión. Nada de lo dispuesto en estos Términos limita los derechos irrenunciables que te reconoce la normativa de protección al consumidor ni la responsabilidad por dolo o culpa inexcusable.' },
        ],
      },
      {
        title: '13. Suspensión y terminación',
        blocks: [
          { p: 'Podemos suspender o dar por terminado tu acceso, previa comunicación y sin devolución de lo pagado, si incumples estos Términos de forma grave o reiterada, en particular por suplantación de identidad, difusión no autorizada de contenidos, acoso o fraude en pagos.' },
        ],
      },
      {
        title: '14. Atención al usuario y Libro de Reclamaciones',
        blocks: [
          { p: '14.1. Puedes enviar consultas, sugerencias o reclamos a atencionalestudiante@netwise.pe. Responderemos en un plazo máximo de 30 días calendario desde su recepción.' },
          { p: '14.2. Contamos con un Libro de Reclamaciones virtual, accesible en reclamos@netwise.pe, conforme al Código de Protección y Defensa del Consumidor (Ley N.° 29571). Puedes acudir además al INDECOPI en cualquier momento.' },
        ],
      },
      {
        title: '15. Modificaciones',
        blocks: [
          { p: 'Podemos actualizar estos Términos para reflejar cambios legales, operativos o de servicio. Publicaremos la versión vigente con su fecha. Las modificaciones no afectan las condiciones del curso en el que ya te encuentres inscrito, salvo obligación legal.' },
        ],
      },
      {
        title: '16. Ley aplicable y jurisdicción',
        blocks: [
          { p: 'Estos Términos se rigen por las leyes de la República del Perú. Para cualquier controversia, las partes se someten a los jueces y tribunales del distrito judicial de Junín (Huancayo), sin perjuicio del derecho del consumidor de acudir a las autoridades administrativas y judiciales que le correspondan por ley.' },
        ],
      },
    ],
  },
  {
    id: 'privacy',
    tab: 'Política de privacidad',
    title: 'Parte II. Política de Uso y Privacidad de Datos Personales',
    sections: [
      {
        title: '1. Responsable del tratamiento',
        blocks: [
          { p: `${PROVIDER}, es titular del banco de datos personales de estudiantes, participantes y usuarios de la Academia y responsable de su tratamiento. Contacto para asuntos de datos personales: ${PRIVACY_EMAIL}.` },
        ],
      },
      {
        title: '2. Marco normativo',
        blocks: [
          { p: 'Tratamos tus datos personales conforme a la Ley N.° 29733, Ley de Protección de Datos Personales, su Reglamento (Decreto Supremo N.° 016-2024-JUS) y demás normas complementarias.' },
        ],
      },
      {
        title: '3. Datos que recopilamos',
        blocks: [
          { table: {
            head: ['Categoría', 'Ejemplos', 'Cuándo se recopilan'],
            rows: [
              ['Identificación y contacto', 'Nombres y apellidos, DNI o documento de identidad, correo, teléfono, ciudad', 'Registro, inscripción, emisión de certificados'],
              ['Perfil profesional', 'Ocupación, empresa, rubro, nivel de experiencia, intereses', 'Formularios de inscripción y encuestas'],
              ['Facturación y pago', 'RUC, razón social, dirección fiscal, historial de pagos, últimos dígitos de la tarjeta', 'Pago y comprobantes (los datos completos de tarjeta los procesa la pasarela de pago)'],
              ['Académicos', 'Asistencia, actividades entregadas, proyectos, calificaciones y certificados', 'Durante el curso'],
              ['Imagen y voz', 'Imagen, voz y participación en videoconferencias y grabaciones', 'Clases y master classes en vivo'],
              ['Técnicos y de navegación', 'Dirección IP, dispositivo, navegador, páginas visitadas, cookies y datos de interacción con anuncios', 'Uso del sitio web y campañas digitales'],
              ['Comunicaciones', 'Mensajes por correo, WhatsApp, formularios y redes sociales', 'Consultas y atención'],
            ],
          } },
          { p: 'No solicitamos datos sensibles. Te pedimos no incluirlos en tus trabajos, formularios o mensajes.' },
        ],
      },
      {
        title: '4. Finalidades del tratamiento',
        blocks: [
          { p: 'a) Finalidades necesarias para prestar el servicio (no requieren consentimiento adicional porque son inherentes a la relación contractual):' },
          { ul: [
            'Gestionar tu registro, inscripción, matrícula y acceso a las aulas virtuales.',
            'Procesar pagos, emitir comprobantes y gestionar devoluciones.',
            'Dictar las clases, registrar asistencia, evaluar actividades y emitir certificados.',
            'Brindar soporte y atender consultas, reclamos y solicitudes.',
            'Cumplir obligaciones legales, tributarias y contables.',
          ] },
          { p: 'b) Finalidades adicionales (requieren tu consentimiento libre, previo, expreso, informado e inequívoco, que puedes negarte a dar sin que afecte tu acceso al curso):' },
          { ul: [
            'Enviarte información, promociones y ofertas de cursos, master classes y eventos de Netwise Academy y de empresas vinculadas del ecosistema Netwise, por correo, WhatsApp, SMS o llamadas.',
            'Realizar análisis de mercado, encuestas de satisfacción y perfilamiento para mejorar nuestra oferta y segmentar comunicaciones.',
            'Usar tu testimonio, imagen o proyecto en piezas de difusión de la Academia (con autorización específica por escrito para cada uso).',
            'Crear audiencias personalizadas o similares en plataformas publicitarias (por ejemplo, Meta) a partir de tus datos de contacto.',
          ] },
        ],
      },
      {
        title: '5. Consentimiento',
        blocks: [
          { p: `Al marcar las casillas correspondientes en nuestros formularios, otorgas tu consentimiento para las finalidades indicadas. Las casillas de finalidades adicionales no vienen premarcadas y se solicitan de forma separada a la aceptación de los Términos. Puedes revocar tu consentimiento en cualquier momento, sin efectos retroactivos, escribiendo a ${PRIVACY_EMAIL} o usando el enlace de baja de nuestras comunicaciones.` },
        ],
      },
      {
        title: '6. Grabaciones de clases y master classes',
        blocks: [
          { p: 'Las sesiones en vivo se graban para fines académicos y para que los estudiantes inscritos las revisen. La grabación puede captar tu voz, imagen (si activas la cámara) y participación en el chat. Si no deseas aparecer, puedes mantener tu cámara apagada y usar un nombre de pantalla. Las grabaciones se comparten únicamente con los estudiantes inscritos en el curso y podrán ser publicadas en forma abierta en los canales de la empresa.' },
        ],
      },
      {
        title: '7. Cookies y tecnologías de seguimiento',
        blocks: [
          { p: 'Nuestro sitio y páginas de captación pueden usar cookies y píxeles de seguimiento (por ejemplo, Meta Pixel y herramientas de analítica como Google Analytics) para medir el rendimiento del sitio, entender cómo se usa y evaluar campañas publicitarias. Puedes rechazar o configurar las cookies no esenciales desde el aviso de cookies del sitio o desde los ajustes de tu navegador. Rechazarlas no impide el uso de las funciones esenciales.' },
        ],
      },
      {
        title: '8. Destinatarios y transferencia de datos',
        blocks: [
          { p: 'No vendemos tus datos personales. Podemos compartirlos con encargados y proveedores que nos prestan servicios bajo contrato y con deber de confidencialidad, por ejemplo:' },
          { ul: [
            'Plataformas de videoconferencia y aulas virtuales.',
            'Pasarelas de pago y entidades financieras.',
            'Servicios de alojamiento web, correo electrónico, CRM y automatización de marketing.',
            'Plataformas de publicidad y analítica.',
            'Asesores contables, legales y de facturación electrónica.',
          ] },
          { p: 'Algunos proveedores están ubicados fuera del Perú (por ejemplo, en Estados Unidos, para el caso de Google Meet). También podemos entregar datos a autoridades competentes cuando exista un requerimiento legal.' },
        ],
      },
      {
        title: '9. Plazo de conservación',
        blocks: [
          { p: 'Conservamos tus datos mientras dure la relación con la Academia y, después, por el tiempo necesario para las finalidades descritas y para cumplir obligaciones legales: por ejemplo, 5 años para registros contables y tributarios, y 5 años para el registro de certificados emitidos.' },
          { p: 'Los datos tratados solo con base en tu consentimiento de marketing se conservan hasta que lo revoques o por un máximo de 36 meses de inactividad. Vencidos los plazos, se eliminan.' },
        ],
      },
      {
        title: '10. Seguridad',
        blocks: [
          { p: 'Aplicamos medidas técnicas, organizativas y legales razonables para proteger tus datos frente a acceso no autorizado, pérdida, alteración o divulgación, incluyendo control de accesos, credenciales personales, cifrado en tránsito cuando la herramienta lo permite y acuerdos de confidencialidad con el personal y los proveedores. Ante un incidente de seguridad que afecte tus datos, actuaremos y notificaremos según lo exige la normativa vigente. Ningún sistema es infalible, por lo que también te pedimos cuidar tus credenciales, datos y accesos.' },
        ],
      },
      {
        title: '11. Tus derechos',
        blocks: [
          { p: 'Como titular de datos personales, puedes ejercer los derechos de:' },
          { ul: [
            { term: 'Información', text: 'conocer cómo tratamos tus datos.' },
            { term: 'Acceso', text: 'obtener copia de tus datos y detalles de su tratamiento.' },
            { term: 'Rectificación (actualización, inclusión)', text: 'corregir datos inexactos o incompletos.' },
            { term: 'Cancelación (supresión)', text: 'solicitar la eliminación de tus datos cuando ya no sean necesarios o hayas revocado el consentimiento.' },
            { term: 'Oposición', text: 'oponerte a un tratamiento determinado, en especial al de marketing.' },
            { term: 'Revocación', text: 'retirar el consentimiento otorgado para finalidades adicionales.' },
            { term: 'Tratamiento objetivo', text: 'no ser sometido a decisiones basadas únicamente en tratamientos automatizados que te afecten significativamente, cuando corresponda.' },
          ] },
          { p: `Cómo ejercerlos: envía una solicitud a ${PRIVACY_EMAIL} indicando tu nombre completo, copia de tu documento de identidad, el derecho que ejerces y una descripción clara de tu pedido. Responderemos dentro de los plazos previstos por la normativa. Si consideras que tus derechos no han sido atendidos, puedes presentar una reclamación ante la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia y Derechos Humanos.` },
        ],
      },
      {
        title: '12. Menores de edad',
        blocks: [
          { p: 'Nuestros servicios están dirigidos a mayores de 18 años. No recopilamos intencionalmente datos de menores. Si detectamos que un menor se registró, eliminaremos sus datos.' },
        ],
      },
      {
        title: '13. Enlaces y servicios de terceros',
        blocks: [
          { p: 'Nuestro sitio y comunicaciones pueden contener enlaces a sitios o plataformas de terceros (redes sociales, videoconferencia, pasarelas de pago). Su tratamiento de datos se rige por sus propias políticas, sobre las cuales no tenemos control.' },
        ],
      },
      {
        title: '14. Cambios en esta Política',
        blocks: [
          { p: 'Podemos actualizar esta Política para reflejar cambios normativos o de nuestros servicios. Publicaremos la versión vigente con su fecha de actualización y, si el cambio es sustancial, te lo comunicaremos por correo o en el sitio.' },
        ],
      },
    ],
  },
];
