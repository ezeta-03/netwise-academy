import React from 'react';
import { useOutletContext } from 'react-router-dom';
import AssistantChat from '../../components/AssistantChat';

// Asistente IA del alumno (E13): responde con el sílabo, los materiales y las
// fechas de su aula, y conoce su empresa (Mi proyecto) para dar ejemplos.
const StudentCourseIA = () => {
  const { course, group } = useOutletContext();
  return (
    <AssistantChat
      course={course} groupId={group?.id || null}
      subtitle={`${course.title}${group?.name ? ` · ${group.name}` : ''}`}
      placeholder="Escribe tu duda sobre este curso..."
      starters={['Explícame el tema de esta semana', '¿Qué pide la entrega del módulo?', 'Hazme 3 preguntas de práctica', '¿Cuándo vencen mis entregas?']}
      followUps={['Dame un ejemplo con otra marca', 'Hazme 3 preguntas de práctica', '¿Cómo lo uso en mi entrega?']}
    />
  );
};

export default StudentCourseIA;
