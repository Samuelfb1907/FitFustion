// Jest-Setup fuer reine Logik-Tests (lib/). ts-jest + node-Umgebung - kein RN/Expo noetig,
// da die getesteten Module (nutrition, gamification) keine nativen Imports haben.
// Lauf: `npm test` (siehe package.json). Bewusst auf __tests__/*.test.ts begrenzt.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
};
