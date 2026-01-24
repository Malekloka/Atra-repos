// star names are two or three letters followed by a number
export const randomStarName = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const name = letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)] +
    '-' +
    Math.floor(Math.random() * 100 + 10);
  return name;
}

console.log(randomStarName());