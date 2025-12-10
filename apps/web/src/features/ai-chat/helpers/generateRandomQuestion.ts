export function generateRandomQuestion() {
  const questions = [
    'How are my liver enzymes?',
    'When was my last flu shot?',
    'What was my blood pressure last visit?',
    'How is my cholesterol?',
    'What are my allergies?',
    'What are my medications?',
  ];
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}
