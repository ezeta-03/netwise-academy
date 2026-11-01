import React from 'react';
import { useOutletContext } from 'react-router-dom';
import AssistantChat from '../../components/AssistantChat';

// Asistente IA del docente: el mismo chat, con las instrucciones para docentes
// que configura el admin (A6).
const TeacherCourseIA = () => {
  const { course, group } = useOutletContext();
  return (
    <AssistantChat
      course={course} groupId={group?.id || null}
      subtitle={`${course.title}${group?.name ? ` · ${group.name}` : ''} · Prepara clases, retroalimentación y preguntas de repaso.`}
      placeholder="Escribe lo que necesitas preparar..."
      starters={['Ayúdame a redactar retroalimentación para una entrega', 'Genera 5 preguntas de repaso de este módulo', 'Propón criterios de rúbrica para la entrega', 'Prepara el guion de la próxima sesión']}
      followUps={['Hazlo más breve', 'Dame otro ejemplo', 'Conviértelo en una práctica de clase']}
    />
  );
};

export default TeacherCourseIA;
